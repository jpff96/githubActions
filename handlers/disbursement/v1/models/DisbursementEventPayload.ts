import { Disbursement } from './Disbursement';

/**
 * @class DisbursementEventPayload
 */
export class DisbursementEventPayload {
  batchId: string;
  batchNumber: string;
  disbursementId: string;
  disbursementNumber: string;
  referenceId: string;
  referenceNumber: string;
  releasedDateTime: string;
  state: Disbursement.States;

  /**
   * Initializes a new instance of the @see DisbursementEventPayload class.
   * @param disbursement
   */
  constructor(disbursement: Disbursement) {
    this.loadFromDisbursement(disbursement);
  }

  /**
   * Load model from record or source snippet
   *
   * @param disbursement
   */
  loadFromDisbursement = (disbursement: Disbursement) => {
    if (disbursement) {
      this.batchId = disbursement.batchId;
      this.batchNumber = disbursement.batchNumber;
      this.disbursementId = disbursement.pk;
      this.disbursementNumber = disbursement.disbursementNumber;
      this.referenceId = disbursement.referenceId;
      this.referenceNumber = disbursement.referenceNumber;
      this.releasedDateTime = disbursement.releasedDateTime;
      this.state = disbursement.state.state;
    }
  };
}
