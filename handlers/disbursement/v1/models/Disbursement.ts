import { PaymentDetail } from './PaymentDetail';
import { Recipient } from './Recipient';
import { DisbursementHistory } from './DisbursementHistory';
import { DisbursementRepository } from '../DisbursementRepository';
import { Address } from '../../../../models/Address';
import { DeliveryMethodType, CatastropheType, Reasons } from '../../../../libs/enumLib';
import { DisbursementState } from './DisbursementState';

/**
 * @class Disbursement
 */
export class Disbursement {
  pk: string = ''; // entityId_disbursementId
  sk: DisbursementRepository.DisbursementRecordType = DisbursementRepository.DisbursementRecordType.Disbursement;

  amount: number = 0;
  approvalBy: string = '';
  approvalDateTime: string = '';
  batchId: string = '';
  batchNumber: string = '';
  catastropheType: CatastropheType;
  costType: string;
  coverage: string;
  createdDateTime: string = '';
  deliveryMethod: DeliveryMethodType = DeliveryMethodType.Standard;
  description: string = '';
  disbursementHistory: Array<DisbursementHistory> = [];
  disbursementNumber: string = '';
  docTypeNumber: string = ''; // For EntityIndex
  documentKeyList: Array<string> = [];
  documentReconKeyList: Array<string> = [];
  entityId: string = '';
  lastActionBy: string = '';
  lastActionDate: string = '';
  lossDateTime: string;
  mailingAddress: Address = new Address();
  memo: string;
  payerIdOrFundingAccountCode: string = '';
  paymentType: string = '';
  paymentDetailList: Array<PaymentDetail> = [];
  policyId: string = '';
  policyNumber: string = '';
  productKey: string = '';
  reason: Reasons = Reasons.Other;
  recipients: Array<Recipient> = [];
  referenceId: string;
  referenceNumber: string;
  referenceType: DisbursementRepository.DisbursementReferenceType =
    DisbursementRepository.DisbursementReferenceType.Unknown;
  rejectReason: string = '';
  releasedDateTime: string = '';
  shippingCompanyName: string;
  shippingEmail: string;
  shippingFirstName: string;
  shippingLastName: string;
  state: DisbursementState = new DisbursementState();
  trackingNumber: string = '';

  // Provider response attributes
  providerPaymentType: string;
  providerTransactionId: string;
  checkNumber: string;
  mailingClass: string;
  mailingTrackingNumber: string;

  /**
  * Initializes a new instance of the @see Disbursement class.
  * @param src
  */
  constructor(src?: any) {
    this.loadFromSource(src);
  }

  /**
  * Load model from record or source snippet
  *
  * @param src
  */
  loadFromSource = (src?: any) => {
    if (src) {
      this.pk = src.pk;
      this.sk = src.sk;

      this.amount = src.amount;
      this.approvalBy = src.approvalBy;
      this.approvalDateTime = src.approvalDateTime;
      this.batchId = src.batchId;
      this.batchNumber = src.batchNumber;
      this.catastropheType = src.catastropheType;
      this.costType = src.costType;
      this.coverage = src.coverage;
      this.createdDateTime = src.createdDateTime;
      this.deliveryMethod = src.deliveryMethod;
      this.description = src.description;
      this.disbursementNumber = src.disbursementNumber;
      this.docTypeNumber = `${this.sk}_${this.disbursementNumber}`;
      this.documentKeyList = src.documentKeyList || [];
      this.entityId = src.entityId;
      this.lastActionBy = src.lastActionBy;
      this.lastActionDate = src.lastActionDate;
      this.lossDateTime = src.lossDateTime;
      this.mailingAddress.loadFromSource(src.mailingAddress);
      this.memo = src.memo;
      this.payerIdOrFundingAccountCode = src.payerIdOrFundingAccountCode;
      this.paymentType = src.paymentType;
      this.policyId = src.policyId;
      this.policyNumber = src.policyNumber;
      this.productKey = src.productKey;
      this.reason = src.reason || Reasons.Other;
      this.referenceId = src.referenceId;
      this.referenceNumber = src.referenceNumber;
      this.referenceType = src.referenceType || DisbursementRepository.DisbursementReferenceType.Unknown;
      this.rejectReason = src.rejectReason;
      this.releasedDateTime = src.releasedDateTime;
      this.shippingCompanyName = src.shippingCompanyName;
      this.shippingEmail = src.shippingEmail;
      this.shippingFirstName = src.shippingFirstName;
      this.shippingLastName = src.shippingLastName;
      this.state.loadFromSource(src.state);
      this.trackingNumber = src.trackingNumber;

      if (src.paymentDetailList) {
        this.paymentDetailList = src.paymentDetailList.map((detail) => new PaymentDetail(detail));
      }

      if (src.recipients) {
        this.recipients = src.recipients.map((recipient) => new Recipient(recipient));
      }

      if (src.disbursementHistory) {
        this.disbursementHistory = src.disbursementHistory.map((history) => new DisbursementHistory(history));
      }
    }
  };

  /**
  * Updates state and history
  * @param state
  */
  updateState = (state: DisbursementState) => {
    if (state.state !== this.state.state) {
      // Update history
      const newHistoryEntry = new DisbursementHistory({ state: this.state });
      this.disbursementHistory.push(newHistoryEntry);

      // Update current state
      this.state = state;
    }
  };

  /**
  * Save reconciliation document key
  * @param documentKey
  */
  addDocumentReconKey = (documentKey: string) => {
    if (!this.documentReconKeyList) {
      this.documentReconKeyList = [];
    }
    if (!this.documentReconKeyList.includes(documentKey)) {
      this.documentReconKeyList.push(documentKey);
    }
  };
}

export namespace Disbursement {
  /**
   * Status type values derived from operations on the items within the disbursement.
   */
  export enum States {
    None = 'None',
    // Pre provider states
    Pending = 'Pending', // Pending approval
    Approved = 'Approved', // Approved and ready to send to provider
    Rejected = 'Rejected', // Rejected and no send to provider
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
   * Action type values.
   */
  export enum Actions {
    Approve = 'Approve',
    Reject = 'Reject',
    MoveBatch = 'MoveBatch'
  }
}
