import { LockboxRepository } from '../LockboxRepository';
import { CheckTransaction } from './CheckTransaction';
import { Document } from './Document';

/**
 * @class Batch
 */
export class Batch {
  pk: string = ''; // entityId_batch id
  sk: LockboxRepository.LockboxRecordType = LockboxRepository.LockboxRecordType.Batch;
  batchId: string = '';
  entityId: string = '';
  lockbox: string = '';
  account: string = '';
  totalAmount: number = 0;
  processDate: string = '';
  suspenseCount: number = 0;
  approvedCount: number = 0;
  status = Batch.Status.Suspense;
  lastActionBy: string = '';
  lastActionDate: string = '';

  transactions: Array<CheckTransaction> = [];
  documents: Array<Document> = [];

  /**
   * Initializes a new instance of the @see Batch class.
   * @param src
   */
  constructor(src?: any) {
    if (src) {
      this.pk = src.pk;
      this.sk = src.sk;
      this.batchId = src.batchId;
      this.entityId = src.entityId;
      this.lockbox = src.lockbox;
      this.account = src.account;
      this.totalAmount = src.totalAmount;
      this.processDate = src.processDate;
      this.suspenseCount = src.suspenseCount;
      this.approvedCount = src.approvedCount;
      this.status = src.status;
      this.lastActionBy = src.lastActionBy;
      this.lastActionDate = src.lastActionDate;

      this.transactions = src.transactions;
      this.documents = src.documents;
    }
  }
}

export namespace Batch {
  /**
   * Status type values derived from operations on the items within the lockbox.
   */
  export enum Status {
    Balanced = 'Balanced',
    Suspense = 'Suspense',
    Released = 'Released'
  }
}
