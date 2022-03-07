import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { Disbursement } from '.';

/**
 * DisbursementList
 * @class DisbursementList
 */
export class DisbursementList {
  lastEvaluatedKey: DocumentClient.Key;
  disbursements: Array<Disbursement>;

  /**
   * Initializes a new instance of the @see {DisbursementList} class.
   * @param lastEvaluatedKey Last evaluated key.
   * @param disbursements List of disbursements.
   */
  constructor(lastEvaluatedKey: DocumentClient.Key, disbursements: Array<Disbursement>) {
    this.lastEvaluatedKey = lastEvaluatedKey;
    this.disbursements = disbursements;
  }
}
