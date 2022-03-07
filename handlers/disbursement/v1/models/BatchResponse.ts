import { DisbursementRepository } from '../DisbursementRepository';
import { Batch } from './Batch';
import { Disbursement } from './Disbursement';

/**
 * @class BatchResponse
 */
export class BatchResponse {
  pk: string = ''; // entityId_batch id
  sk: DisbursementRepository.BatchRecordType = DisbursementRepository.BatchRecordType.Batch;
  batchNumber: string = '';
  docTypeNumber: string = '';
  entityId: string = '';
  releasedDateTime: string = '';
  scheduledDateTime: string = '';
  state: Batch.States = Batch.States.Scheduled;
  lastActionBy: string = '';
  lastActionDate: string = '';
  disbursements: Array<Disbursement>;

  /**
   * Initializes a new instance of the @see BatchResponse class.
   * @param src
   */
  constructor(src?: any) {
    if (src) {
      this.pk = src.pk;
      this.sk = src.sk;
      this.batchNumber = src.batchNumber;
      this.docTypeNumber = src.docTypeNumber;
      this.entityId = src.entityId;
      this.releasedDateTime = src.releasedDateTime;
      this.scheduledDateTime = src.scheduledDateTime;
      this.state = src.state;
      this.lastActionBy = src.lastActionBy;
      this.lastActionDate = src.lastActionDate;
      this.disbursements = src.disbursements;
    }
  }
}
