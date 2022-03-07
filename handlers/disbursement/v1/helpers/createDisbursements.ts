import { differenceInCalendarDays, parseISO } from 'date-fns';
import { getBatchForDisbursement } from './getBatchForDisbursement';
import { getBatchType } from './getType';
import { DisbursementRepository } from '../DisbursementRepository';
import {
  Disbursement,
  DisbursementEventPayload,
  DisbursementPayload,
  DisbursementState,
  Recipient
} from '../models';
import { validateCreateDisbursement } from '../validation/createDisbursementValidation';
import { client } from '../../../../libs/dynamodb';
import { CostType } from '../../../../libs/enumLib';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { ProductAPI } from '../../../../libs/API/ProductAPI';
import { ProductAccounting } from '@eclipsetechnology/product-library/dist/models/ProductAccounting';
import { ErrorCodes, NotFoundError } from '../../../../libs/errors';
import { logError } from '@eclipsetechnology/eclipse-api-helpers';

const { DisbursementRecordType } = DisbursementRepository;

/**
 * Creates disbursements
 * @param entityId  Owner entity id
 * @param input     Data to create a disbursement
 */
export const createDisbursements = async (entityId: string, input: DisbursementPayload, transEffectiveDate?: string): Promise<Array<Disbursement>> => {
  // Clean DisbursementPayload object to ensure correct use of Joi validator
  const data = JSON.parse(JSON.stringify(input));

  validateCreateDisbursement(data);

  let { disbursementType, recipients, productKey, catastropheType, costType } = data;

  disbursementType = disbursementType || DisbursementRecordType.Disbursement;

  const batchType = getBatchType(disbursementType);

  const repository = new DisbursementRepository(client);
  let batch;
  const disbursementCreateList: Array<Disbursement> = [];
  const createdDisbursementList: Array<Disbursement> = [];

  // Get accounting config
  const [, productAccounting] = await ProductAPI.getConfiguration(productKey);

  const payerIdOrFundingAccountCode = getPayerIdOrFundingAccountCode(catastropheType, costType, productAccounting);

  // If this is a Zero Payment (print document) create a new disbursement for each recipient
  if (disbursementType === DisbursementRecordType.DisbursementPrint) {
    for (const recipient of recipients) {
      const newDisbursement = new Disbursement(data);
      newDisbursement.payerIdOrFundingAccountCode = payerIdOrFundingAccountCode;
      const newRecipient = new Recipient(recipient);
      newRecipient.isDefaultRecipient = true;
      newDisbursement.recipients = [newRecipient];
      newDisbursement.mailingAddress = newRecipient.address;
      disbursementCreateList.push(newDisbursement);
    }
  } else {
    const newDisbursement = new Disbursement(data);
    newDisbursement.payerIdOrFundingAccountCode = payerIdOrFundingAccountCode;
    disbursementCreateList.push(newDisbursement);
  }

  for (const disbursement of disbursementCreateList) {
    if (disbursement.costType === CostType.PremiumRefund) {
      // The batch will be realeased 5 days after the effectiveDate
      const batchReleaseDate = differenceInCalendarDays(parseISO(transEffectiveDate), new Date()) + 5;
      batch = await getBatchForDisbursement(repository, batchType, entityId, batchReleaseDate);
      disbursement.updateState(new DisbursementState({ state: Disbursement.States.Pending }));
    } else {
      batch = await getBatchForDisbursement(repository, batchType, entityId);
      disbursement.updateState(new DisbursementState({ state: Disbursement.States.Approved }));
    }

    disbursement.batchId = batch.pk;
    disbursement.batchNumber = batch.batchNumber;
    disbursement.entityId = entityId;

    const createdDisbursement = await repository.saveDisbursement(disbursement, disbursementType);
    createdDisbursementList.push(createdDisbursement);

    // Send a event with the information of the created disbursement
    const { returnEvent, paymentId } = data;

    if (returnEvent) {
      const { policyId } = createdDisbursement;
      const disbursementEventPayload = new DisbursementEventPayload(createdDisbursement);
      const detail = ServiceEventProducer.createDisbursementCreatedEventDetail(disbursementEventPayload, policyId, paymentId);

      await ServiceEventProducer.sendServiceEvent(detail, returnEvent);
    }
  }

  return createdDisbursementList;
};

/**
 * Obtains the account for current costType and catastropheType.
 * @param catastropheType Disbursement catastrophe type
 * @param costType Disbursement cost type
 * @param productAccounting Product Account Data
 */
const getPayerIdOrFundingAccountCode = (
  catastropheType: string,
  costType: string,
  productAccounting: ProductAccounting
): string => {
  try {
    const { reservePaymentInfoList } = productAccounting;

    const reservePaymentInfo = reservePaymentInfoList.find(
      (element) =>
        element.configName === costType &&
        (costType !== CostType.ExpenseDefenseAndCostContainment ||
          (costType === CostType.ExpenseDefenseAndCostContainment &&
            (!catastropheType || element.catastrophes.includes(catastropheType))
          )
        )
    );

    return reservePaymentInfo.account;
  } catch (err) {
    logError(console.log, err, 'reservePaymentInfo_ERROR');

    throw new NotFoundError(ErrorCodes.ReservePaymentInfoNotFound, 'Unable to get reserve payment info from product definition.');
  }
};
