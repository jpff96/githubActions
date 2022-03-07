import { Disbursement } from './Disbursement';

/**
 * @class DisbursementState
 */
export class DisbursementState {
  state: Disbursement.States = Disbursement.States.Pending;
  updatedDateTime: string = new Date().toISOString();

  /**
   * Initializes a new instance of the @see DisbursementState class.
   * @param src
   */
  constructor(src?: any) {
    this.loadFromSource(src);
  }

  /**
   * Load model from record or source snippet
   * @param src
   */
  loadFromSource = (src?: any) => {
    if (src) {
      this.state = src.state;
      this.updatedDateTime = src.updatedDateTime ?? new Date().toISOString();
    }
  };
}
