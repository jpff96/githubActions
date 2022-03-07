import { DocumentClient } from 'aws-sdk/clients/dynamodb';

/**
 * PolicyList
 * @class PolicyList
 */
export class PolicyList {
  lastEvaluatedKey: DocumentClient.Key;
  policies: Array<string>;

  /**
   * Initializes a new instance of the @see {PolicyList} class.
   * @param lastEvaluatedKey Last evaluated key.
   * @param policies List of policy ids.
   */
  constructor(lastEvaluatedKey: DocumentClient.Key, policies: Array<string>) {
    this.lastEvaluatedKey = lastEvaluatedKey;
    this.policies = policies;
  }
}
