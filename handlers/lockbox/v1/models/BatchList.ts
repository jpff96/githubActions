import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { Batch } from './Batch';

/**
 * BatchList
 * @class BatchList
 */
export class BatchList {
  lastEvaluatedKey: DocumentClient.Key;
  batches: Array<Batch>;

  /**
   * Initializes a new instance of the @see {BatchList} class.
   * @param lastEvaluatedKey Last evaluated key.
   * @param batches List of batches.
   */
  constructor(lastEvaluatedKey: DocumentClient.Key, batches: Array<Batch>) {
    this.lastEvaluatedKey = lastEvaluatedKey;
    this.batches = batches;
  }
}
