import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { DisbursementResponse } from './DisbursementResponse';

/**
 * DisbursementListDTO
 * @class DisbursementListDTO
 */
export class DisbursementListDTO {
  lastEvaluatedKey: DocumentClient.Key;
  disbursements: Array<DisbursementResponse>;

  /**
   * Initializes a new instance of the @see {DisbursementListDTO} class.
   * @param lastEvaluatedKey Last evaluated key.
   * @param disbursements List of disbursements.
   */
  constructor(lastEvaluatedKey: DocumentClient.Key, disbursements: Array<DisbursementResponse>) {
    this.lastEvaluatedKey = lastEvaluatedKey;
    this.disbursements = disbursements;
  }

  static loadFromSource = (src?: any): DisbursementListDTO => {
    const disbursementList: DisbursementListDTO = new DisbursementListDTO(
      src.lastEvaluatedKey,
      []
    );
  
    for (const disbursement of src.disbursements) {
      disbursementList.disbursements.push(new DisbursementResponse(disbursement));
    }
  
    return disbursementList;
  }
}
