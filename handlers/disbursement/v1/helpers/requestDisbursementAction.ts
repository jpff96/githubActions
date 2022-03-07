import { DisbursementActionPayload } from "../models/DisbursementActionPayload";
import { DisbursementRepository } from '../DisbursementRepository';
import { BillingRepository } from '../../../accounting/v1/BillingRepository';
import { Disbursement } from "../models";
import { DisbursementState } from '../models/DisbursementState';
import { validateAction } from "../validation/actionValidation";
import { ArgumentError, ErrorCodes, NotFoundError } from '../../../../libs/errors';
import { client } from '../../../../libs/dynamodb';
import { rejectDisbursement } from "./rejectDisbursement";
import { getBatchType } from "./getType";
import { getBatchForDisbursement } from "./getBatchForDisbursement";
import { formatISO } from "date-fns";
import { ActivityLogProducer } from "../../../../libs/ActivityLogProducer";

const { Actions, States } = Disbursement;
const { DisbursementRecordType } = DisbursementRepository;

/**
 * Request disbursement Action
 * @param entityId  Owner entity id
 * @param input     Data to handle action of
 */
export const requestDisbursementAction =  async (userEmail: string, input: any, isEvent: boolean = false): Promise<Disbursement> => {
  validateAction(input);

  const data = new DisbursementActionPayload(input)
  const {
    disbursementId,
    action,
    disbursementType: srcDisbursementType,
    paymentId,
    rejectReason,
    returnEvent
  } = data;
  const disbursementType = srcDisbursementType || DisbursementRecordType.Disbursement;

  const repository = new DisbursementRepository(client);
  const disbursement = await repository.getDisbursement(disbursementId, disbursementType);
  if (disbursement === null) {
    throw new NotFoundError(ErrorCodes.NotFound, `No disbursement for key ${disbursementId} was found`);
  }
  const { state: oldStateDisbursement } = disbursement;
  const oldState = oldStateDisbursement.state;
  // Store "Now" for date updates
  const modifiedBy = userEmail;
  const modifiedOn = new Date();

  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(disbursement.policyId);

  const agencyEntityId = billing.agencyEntityId;

  switch (action) {
    case Actions.Approve:
      disbursement.updateState(new DisbursementState({ state: States.Approved }));
      disbursement.approvalBy = modifiedBy;
      disbursement.approvalDateTime = modifiedOn.toISOString();
      // TODO: Validate and do other "interesting" stuff
      break;
    case Actions.Reject:
      const params = {
        paymentId,
        rejectReason,
        returnEvent,
        isEvent
      };

      await rejectDisbursement(disbursement, agencyEntityId, params);
      break;
    case Actions.MoveBatch:
      disbursement.updateState(new DisbursementState({ state: Disbursement.States.Approved }));
      const batchType = getBatchType(disbursementType);
      const nextBatch = await getBatchForDisbursement(repository, batchType, disbursement.entityId);
      disbursement.batchId = nextBatch.pk;
      disbursement.batchNumber = nextBatch.batchNumber;
      break;
    default:
      throw new ArgumentError(ErrorCodes.ArgumentInvalid, `Action not supported. Supported actions: ${Object.values(Actions)}`);
  }

  disbursement.lastActionBy = modifiedBy;
  disbursement.lastActionDate = formatISO(modifiedOn, { representation: 'date' });
  const savedDisbursement = await repository.saveDisbursement(disbursement, disbursementType);
  const { disbursementNumber, policyId, state: newStateDisbursement } = savedDisbursement;
  const newState = newStateDisbursement.state;
  // Send activity logs
  await ActivityLogProducer.sendActivityLog(
    policyId,
    agencyEntityId,
    `Disbursement {{disbursementNumber}} for policy {{policyId}} changed state from {{oldState}} to {{newState}}`,
    {
      disbursementNumber,
      policyId,
      oldState,
      newState
    }
  );
  
  return savedDisbursement;
};
