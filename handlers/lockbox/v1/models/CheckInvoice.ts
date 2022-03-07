import { PaymentPlan } from '../../../accounting/v1/models/PaymentPlan';

/**
 * @class CheckInvoice
 */
export class CheckInvoice {
  invoiceNumber: string = '';
  createdDate: string = '';
  invoiceAmount: number = 0;
  premiumPlan: PaymentPlan.PaymentPlanType = PaymentPlan.PaymentPlanType.FullPay;
  policyPremium: number = 0;
  companionPremium: number = 0;
  installmentFee: number = 0;
  balance: number = 0; // invoiceAmount - transaction amount

  /**
   * Initializes a new instance of the @see CheckInvoice class.
   * @param src
   */
  constructor(src?: any) {
    if (src) {
      this.invoiceNumber = src.invoiceNumber;
      this.createdDate = src.createdDate;
      this.invoiceAmount = src.invoiceAmount;
      this.premiumPlan = src.premiumPlan;
      this.policyPremium = src.policyPremium;
      this.companionPremium = src.companionPremium;
      this.installmentFee = src.installmentFee;
      this.balance = src.balance;
    }
  }
}
