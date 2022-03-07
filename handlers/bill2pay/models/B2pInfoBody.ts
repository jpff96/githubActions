
export class B2pInfoBody {
  amount: string;
  allowCreditCard: string;
  allowECheck: string;
  redirectHref: string;
  accountNumber: string;
  productName: string;
  paymentPlan: string;
  paymentSource: string;
  customerId: string;

  constructor(data?: any) {
    if (data) {
      this.amount = data.amount;
      this.allowCreditCard = data.allowCreditCard;
      this.allowECheck = data.allowECheck;
      this.redirectHref = data.redirectHref;
      this.accountNumber = data.accountNumber;
      this.productName = data.productName;
      this.paymentPlan = data.paymentPlan;
      this.paymentSource = data.paymentSource;
      this.customerId = data.customerId;
    }
  }
}