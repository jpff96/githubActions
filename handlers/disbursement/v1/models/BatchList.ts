import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { BatchResponse } from './BatchResponse';

/**
 * BatchList
 * @class BatchList
 */
export class BatchList {
  lastEvaluatedKey: DocumentClient.Key;
  batches: Array<BatchResponse>;

  /**
   * Initializes a new instance of the @see {BatchList} class.
   * @param lastEvaluatedKey Last evaluated key.
   * @param batches List of batches.
   */
  constructor(lastEvaluatedKey: DocumentClient.Key, batches: Array<BatchResponse>) {
    this.lastEvaluatedKey = lastEvaluatedKey;
    this.batches = batches;
  }
}
