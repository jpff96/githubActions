import { addDays } from 'date-fns';
import { createBatchDate } from './createBatchDate';
import { createBatchNumber } from './createBatchNumber';
import { DisbursementRepository } from '../DisbursementRepository';
import { Batch } from '../models';

/**
 * Gets or creates a batch for a disbursement
 * @param repository
 * @param batchType
 * @param entityId
 * @param daysAfter
 */
export const getBatchForDisbursement = async (
  repository: DisbursementRepository,
  batchType: DisbursementRepository.BatchRecordType,
  entityId: string,
  daysAfter: number = 0
): Promise<Batch> => {
  // Calculate when disbursement should be scheduled
  const schedule = addDays(new Date(), daysAfter);
  const batchDate = createBatchDate(schedule);
  const batchNumber = createBatchNumber(batchDate);
  const batchId = DisbursementRepository.buildId(entityId, batchNumber);

  let batch = await repository.getRecord(batchId, batchType);

  // If the batch exists, get it here. Otherwise create a new one and save it
  if (!batch) {
    batch = new Batch();
    batch.batchNumber = batchNumber;
    batch.entityId = entityId;
    batch.scheduledDateTime = batchDate.toISOString();
    batch.state = Batch.States.Scheduled;

    batch = await repository.saveBatch(batch, batchType);
  }

  return batch;
};
