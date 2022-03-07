import { AccountingDocType, PaymentTypes } from '../../../../libs/enumLib';
import { Image } from '../../../lockbox/v1/models/Image';
import { PaymentLineItems } from './PaymentLineItems';
import { PaymentPlan } from './PaymentPlan';

/**
 * Payment
 * @extends LineItems
 */
export class Payment extends PaymentLineItems {
  accountLast4: string;
  action: Payment.Actions;
  authCode: string;
  batchId: string;
  checkNumber: number;
  cognitoUserId: string;
  companionNumber: string;
  confirmationNumber: string;
  customerId: string;
  disbursementId?: string;
  images?: Array<Image> = [];
  loanNumber: string;
  paymentPlan: PaymentPlan.PaymentPlanType;
  responsibleParty?: PaymentPlan.ResponsibleParty;
  paymentType: PaymentTypes = PaymentTypes.None;
  policyNumber: string;
  postMarkDate: string;
  processedDateTime: string;
  productKey: string;
  provider: string;
  reason?: string;
  receivedDate: string;
  providerFee: number;
  providerReference: string;
  remainingBalance: number;
  status?: Payment.PaymentStatus = Payment.PaymentStatus.None;
  subtotalPlusProviderFee: number;
  type: AccountingDocType = AccountingDocType.Payment;

  /**
   * Initializes a new instance of the @see BalanceDue class.
   * @param data Data to create the object
   */
  constructor(data?: any) {
    super(data);

    if (data) {
      this.accountLast4 = data.accountLast4;
      this.action = data.action ?? Payment.Actions.Payment;
      this.authCode = data.authCode;
      this.batchId = data.batchId;
      this.checkNumber = data.checkNumber;
      this.cognitoUserId = data.cognitoUserId;
      this.companionNumber = data.companionNumber;
      this.confirmationNumber = data.confirmationNumber;
      this.customerId = data.customerId;
      this.disbursementId = data.disbursementId;
      this.images = data.images || [];
      this.loanNumber = data.loanNumber;
      this.paymentPlan = data.paymentPlan;
      this.paymentType = data.paymentType;
      this.policyNumber = data.policyNumber;
      this.postMarkDate = data.postMarkDate;
      this.processedDateTime = data.processedDateTime;
      this.productKey = data.productName || data.productKey;
      this.provider = data.provider;
      this.providerFee = data.providerFee;
      this.providerReference = data.providerReference;
      this.reason = data.reason;
      this.receivedDate = data.receivedDate;
      this.remainingBalance = data.remainingBalance;
      this.status = data.status || Payment.PaymentStatus.None;
      this.subtotalPlusProviderFee = data.subtotalPlusProviderFee;
      this.type = data.type;
    }
  }
}

export namespace Payment {
  /**
   * Payment status
   */
  export enum PaymentStatus {
    // Pre provider states
    None = 'None',
    Pending = 'Pending', // Pending approval
    Approved = 'Approved', // Approved and ready to send to provider
    Voided = 'Voided', // Rejected and no send to provider
    ProviderUploaded = 'ProviderUploaded', // Uploaded to provider
    // Provider states
    ProviderError = 'ProviderError', // Provider processing error
    ProviderProcessed = 'ProviderProcessed', // Provider proccesed successfully, get check mask image
    ProviderVoided = 'ProviderVoided', // Provider payment voided
    ProviderReissued = 'ProviderReissued', // Provider payment reissued
    Mailed = 'Mailed', // Sent to customer
    Cleared = 'Cleared' // Check cashed by customer
  }

  /**
   * Actions that result in creating the payment record
   */
  export enum Actions {
    Payment = 'Payment', // payments recieved ( real money)
    VoidedPayment = 'VoidedPayment', // reverse of payment
    TransferIn = 'TransferIn', // transferred to another policy (like payment is real money)
    TransferOut = 'TransferOut', // transferred from another policy
    CustomerRefund = 'CustomerRefund',
    VoidedRefund = 'VoidedRefund',
    CreditWriteOff = 'CreditWriteOff', // Positive writeoff---Amount received > amount owed
    CreditWriteOffReversal = 'CreditWriteOffReversal',
    BalanceWriteOff = 'BalanceWriteOff', // Negative writeoff---Amount received < amount owed
    BalanceWriteOffReversal = 'BalanceWriteOffReversal'
  }
}
