import { Bill2PayPaymentSources } from "../../../libs/enumLib";

export class InitializeRequest {
  allowCreditCard: boolean;
  allowECheck: boolean;
  amount: number;
  policyId: string;
  companionNumber: string;
  policyNumber: string;
  provider: string;
  paymentPlan: string
  redirectHref: string;
  paymentSource: Bill2PayPaymentSources = Bill2PayPaymentSources.PORTAL;
  productName: string;
  customerId: string;
  accountNumber: string;
  sdeType: string;
  effectiveDate: Date;
  expirationDate: Date;

  constructor(data?: any) {
    if (data) {
      this.allowCreditCard = data.allowCreditCard;
      this.allowECheck = data.allowECheck;
      this.amount = data.amount;
      this.policyId = data.policyId;
      this.companionNumber = data.companionId || '';
      this.policyNumber = data.policyNumber;
      this.paymentSource = data.paymentSource;
      this.provider = data.provider;
      this.redirectHref = data.redirectHref;
      this.customerId = data.customerId;
      this.accountNumber = data.accountNumber;
      this.effectiveDate = data.effectiveDate || '';
      this.expirationDate = data.expirationDate || '';
      this.productName = data.productName;
      this.paymentPlan = data.paymentPlan;
      this.sdeType = data.sdeType;
    }
  }
}
