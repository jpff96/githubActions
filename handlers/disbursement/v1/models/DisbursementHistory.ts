import { DisbursementState } from './DisbursementState';

/**
 * @class DisbursementHistory
 */
export class DisbursementHistory {
  state: DisbursementState = new DisbursementState();

  /**
   * Initializes a new instance of the @see DisbursementHistory class.
   * @param src
   */
  constructor(src?: any) {
    if (src) {
      this.state = src.state;
    }
  }
}
