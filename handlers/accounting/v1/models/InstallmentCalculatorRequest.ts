/**
 * InstallmentCalculatorRequest
 */
export class InstallmentCalculatorRequest {
  mainPremium: number = 0;
  companionPremium: number = 0;
  totalFees: number = 0;
  totalTaxes: number = 0;
  effectiveDate: string = '';

  totalAmount: number = 0;
  totalFeesAndTaxes: number = 0;

  /**
   * Initializes a new instance of the @see InstallmentCalculatorRequest class.
   * @param data Data to create the object
   */
  constructor(data?: any) {
    if (data) {
      this.mainPremium = data.mainPremium;
      this.companionPremium = data.companionPremium;
      this.totalFees = data.totalFees;
      this.totalTaxes = data.totalTaxes;
      this.effectiveDate = data.effectiveDate;

      this.totalFeesAndTaxes = this.totalFees + this.totalTaxes;
      this.totalAmount = this.mainPremium + this.companionPremium + this.totalFeesAndTaxes;
    }
  }
}
