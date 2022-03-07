/**
 * NextInstallmentAmountDueResult
 */
export class NextInstallmentAmountDueResult {
  amountToBePaid: number = 0;
  isFirstPayment: boolean;

  /**
   * Initializes a new instance of the @see NextInstallmentAmountDueResult class.
   * @param data Data to create the object
   */
  constructor(data?: any) {
    if (data) {
      this.amountToBePaid = data.amountToBePaid;
      this.isFirstPayment = data.isFirstPayment;
    }
  }
}
