import { DisbursementRepository } from '../DisbursementRepository';

/**
 * @class Batch
 */
export class Batch {
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

  /**
   * Initializes a new instance of the @see Batch class.
   * @param src
   */
  constructor(src?: any) {
    if (src) {
      this.pk = src.pk;
      this.sk = src.sk;
      this.batchNumber = src.batchNumber;
      this.docTypeNumber = `${this.sk}_${this.batchNumber}`;
      this.entityId = src.entityId;
      this.releasedDateTime = src.releasedDateTime;
      this.scheduledDateTime = src.scheduledDateTime;
      this.state = src.state;
      this.lastActionBy = src.lastActionBy;
      this.lastActionDate = src.lastActionDate;
    }
  }
}

export namespace Batch {
  /**
   * State type values derived from operations on the items within the batch.
   */
  export enum States {
    Scheduled = 'Scheduled',
    Issued = 'Issued'
  }
}
