import { DisbursementRepository } from '../DisbursementRepository';
const { DisbursementRecordType, BatchRecordType } = DisbursementRepository;

/**
 * Gets batch type
 * @param disbursementType The disbursement type
 */
export const getBatchType = (
  disbursementType: DisbursementRepository.DisbursementRecordType
): DisbursementRepository.BatchRecordType => {
  let batchType;

  switch (disbursementType) {
    case DisbursementRecordType.ClaimDisbursement:
      batchType = BatchRecordType.ClaimBatch;
      break;

    case DisbursementRecordType.Disbursement:
      batchType = BatchRecordType.Batch;
      break;

    case DisbursementRecordType.DisbursementPrint:
      batchType = BatchRecordType.PrintBatch;
      break;

    default:
      batchType = BatchRecordType.Batch
      break;
  }

  return batchType;
};

/**
 * Gets disbursement type.
 * @param batchType The batch type.
 */
export const getDisbursementType = (
  batchType: DisbursementRepository.BatchRecordType
): DisbursementRepository.DisbursementRecordType => {
  let disbursementType = DisbursementRecordType.Disbursement;

  if (batchType === BatchRecordType.ClaimBatch) {
    disbursementType = DisbursementRecordType.ClaimDisbursement;
  }

  return disbursementType;
};

/**
 * Gets disbursement type list.
 * @param batchType The batch type.
 */
export const getDisbursementTypeList = (
  batchType: DisbursementRepository.BatchRecordType
): Array<DisbursementRepository.DisbursementRecordType> => {
  let disbursementType = [DisbursementRecordType.Disbursement, DisbursementRecordType.DisbursementPrint];

  if (batchType === BatchRecordType.ClaimBatch) {
    disbursementType = [DisbursementRecordType.ClaimDisbursement];
  }

  return disbursementType;
};
