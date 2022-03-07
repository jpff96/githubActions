import { ScheduledEvent, Handler } from 'aws-lambda';
import { format, utcToZonedTime } from 'date-fns-tz';
import { logError } from '@eclipsetechnology/eclipse-api-helpers';
import { DisbursementRepository } from '../DisbursementRepository';
import { createBatchDate } from '../helpers/createBatchDate';
import { createBatchNumber } from '../helpers/createBatchNumber';
import { getBatchForDisbursement } from '../helpers/getBatchForDisbursement';
import { getDisbursementTypeList } from '../helpers/getType';
import { Batch, BatchList, Disbursement } from '../models';
import { upload as uploadToVPay } from '../../../vPay/v1/upload';
import { ProductAPI } from '../../../../libs/API/ProductAPI';
import { client } from '../../../../libs/dynamodb';
import { DynamoDBComparators, TimeZoneType } from '../../../../libs/enumLib';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { DisbursementState } from '../models/DisbursementState';

const { DisbursementRecordType, BatchRecordType } = DisbursementRepository;

const batchRecordTypes = [
  BatchRecordType.Batch,
  BatchRecordType.ClaimBatch,
  BatchRecordType.PrintBatch
];

/**
 * Main entry point for the disburse CRON job.
 * @param event Event data.
 */
export const disburse: Handler = async (event: ScheduledEvent) => {
  try {
    // Get all the products and iterate them to get all the batches for that day
    const products = await ProductAPI.getProductList();

    for (const productKey of products) {
      const [productMain] = await ProductAPI.getConfiguration(productKey);
      const entityId = productMain.consumerInfo.agencyKey;

      const batchDate = createBatchDate(new Date());
      const batchNumber = createBatchNumber(batchDate);
      const batchId = DisbursementRepository.buildId(entityId, batchNumber);
      const repository = new DisbursementRepository(client);

      for (const batchType of batchRecordTypes) {
        try {
          const batch = await repository.getRecord(batchId, batchType);

          if (batch) {
            const disbursementRecordTypes = getDisbursementTypeList(batchType);

            // Get all the disbursement for each record type
            for (const disbursementType of disbursementRecordTypes) {

              // Process approved disbursements
              const getApprovedDisbursementsFilters = {
                disbursementType,
                state: Disbursement.States.Approved
              };
              const approvedDisbursementList = await repository.getDisbursements(batchId, getApprovedDisbursementsFilters);

              if (approvedDisbursementList.length > 0) {
                // Different cases or providers
                switch (disbursementType) {
                  case DisbursementRecordType.Disbursement:
                  case DisbursementRecordType.ClaimDisbursement:
                  case DisbursementRecordType.DisbursementPrint:
                    await uploadToVPay(entityId, approvedDisbursementList);
                    break;

                  default:
                    break;
                }

                // Update batches and disbursements states
                await repository.updateBatchState(batchId, batchType, Batch.States.Issued);

                for (const disbursement of approvedDisbursementList) {
                  disbursement.updateState(new DisbursementState({ state: Disbursement.States.ProviderUploaded }));

                  await repository.saveDisbursement(disbursement);

                  // Send events to notify requestors that the disbursements have been issued.
                  const eventDetail = ServiceEventProducer.createDisbursementUpdatedEventDetail(disbursement);
                  let detailType;

                  if (disbursementType === DisbursementRecordType.Disbursement) {
                    detailType = ServiceEventProducer.DetailType.DisbursementUpdated;
                  } else if (disbursementType === DisbursementRecordType.ClaimDisbursement) {
                    detailType = ServiceEventProducer.DetailType.ClaimDisbursementUpdated;
                  }

                  await ServiceEventProducer.sendServiceEvent(eventDetail, detailType);
                }
              }
            }

          }
        } catch (ex) {
          logError(console.log, ex, 'disburse_batch_ERROR');

          throw ex;
        } finally {
          // Move unreleased disbursements to the next batch
          // BUG 10333: Comenting next line until we have a fix for the self-healing method
          // await moveUnreleasedDisbursementToNextBatch(entityId, batchType, repository);
        }
      }
    }

    return 'OK';
  } catch (ex) {
    logError(console.log, ex, 'disburse_ERROR');

    throw ex;
  }
};

/**
 * Move unreleased disbursements to the next batch
 * @param entityId    Entity ID
 * @param batchType   Batch type
 * @param repository  Disbursement repository
 */
const moveUnreleasedDisbursementToNextBatch = async (
  entityId: string,
  batchType: DisbursementRepository.BatchRecordType,
  repository: DisbursementRepository
) => {
  const endBatchNumber = createBatchNumberEndDate();
  const getBatchListFilters = { endBatchNumber };
  const batchList = new BatchList(null, []);
  let queryResult: BatchList;

  do {
    queryResult = await repository.getBatchList(entityId, batchType, getBatchListFilters, 100, batchList.lastEvaluatedKey);

    if (queryResult.batches.length > 0) {
      batchList.batches.push(...queryResult.batches);
    }

    batchList.lastEvaluatedKey = queryResult.lastEvaluatedKey;
  } while (batchList.lastEvaluatedKey);

  for (const batch of batchList.batches) {
    const { pk: batchId } = batch;
    const disbursementRecordTypes = getDisbursementTypeList(batchType);

    for (const disbursementType of disbursementRecordTypes) {
      // Get unreleased disbursements for that batch
      const getUnreleasedDisbursementsFilters = {
        disbursementType,
        state: Disbursement.States.ProviderUploaded,
        stateComparator: DynamoDBComparators.NotEqual
      };

      const unreleasedDisbursementList = await repository.getDisbursements(batchId, getUnreleasedDisbursementsFilters);

      if (unreleasedDisbursementList.length > 0) {
        const nextBatch = await getBatchForDisbursement(repository, batchType, entityId, 1);

        for (const disbursement of unreleasedDisbursementList) {
          const { pk: disbursementId, sk: disbursementType, state } = disbursement;

          if (state.state !== Disbursement.States.Rejected) {
            await repository.updateDisbursementBatch(disbursementId, disbursementType, nextBatch.pk, nextBatch.batchNumber);
          }
        }
      }
    }
  }
};

/**
 * Creates a batch number end date
 */
export const createBatchNumberEndDate = (): string => {
  const timeZone = TimeZoneType.AmericaChicago;
  const formatOptions = { timeZone };
  const endDate = new Date();
  const endDateTz = utcToZonedTime(endDate, timeZone);
  const formattedEndDate = format(endDateTz, 'yyyyMMdd', formatOptions);

  return formattedEndDate;
};
