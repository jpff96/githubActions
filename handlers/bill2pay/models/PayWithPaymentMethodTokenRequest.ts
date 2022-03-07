export class PaymentWithPaymentMethodRequest {
  accountNumber: string;
  allowCreditCard: boolean;
  allowECheck: boolean;
  amount: number;
  customerId: string;
  isFirstPayment: boolean;
  paymentMethodToken: string;
  paymentPlan: string;
  paymentSource: string;
  policyId: string;
  policyNumber: string;
  productName: string;
  provider: string;
  redirectHref: string;

  constructor(data?: any) {
    if (data) {
      this.accountNumber = data.accountNumber;
      this.allowCreditCard = data.allowCreditCard;
      this.allowECheck = data.allowECheck;
      this.amount = data.amount;
      this.customerId = data.customerId;
      this.isFirstPayment = data.isFirstPayment;
      this.paymentMethodToken = data.paymentMethodToken;
      this.paymentPlan = data.paymentPlan;
      this.paymentSource = data.paymentSource;
      this.policyId = data.policyId;
      this.policyNumber = data.policyNumber;
      this.productName = data.productName;
      this.provider = data.provider;
      this.redirectHref = data.redirectHref;
    }
  }
}
