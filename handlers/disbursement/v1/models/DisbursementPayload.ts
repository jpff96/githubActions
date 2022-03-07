import { PaymentDetail } from './PaymentDetail';
import { Recipient } from './Recipient';
import { Address } from '../../../../models/Address';
import { DisbursementRepository } from '../DisbursementRepository';
import { CostType, DeliveryMethodType, CatastropheType } from '../../../../libs/enumLib';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';

/**
 * Information used to represent disburstment payment info
 */
export class DisbursementPayload {
  amount: number;
  approvalBy: string;
  approvalDateTime: string;
  catastropheType: CatastropheType;
  costType: CostType;
  coverage: string;
  deliveryMethod: DeliveryMethodType;
  description: string;
  disbursementType: DisbursementRepository.DisbursementRecordType;
  documentKeyList: Array<string> = [];
  lossDateTime: string;
  mailingAddress: Address = new Address();
  memberName: string;
  memo: string;
  paymentId: string;
  paymentDetailList: Array<PaymentDetail> = [];
  policyId: string;
  policyNumber: string;
  productKey: string;
  reason: string;
  recipients: Array<Recipient> = [];
  referenceId: string;
  referenceNumber: string;
  referenceType: DisbursementRepository.DisbursementReferenceType;
  returnEvent: ServiceEventProducer.DetailType;
  shippingCompanyName: string;
  shippingEmail: string;
  shippingFirstName: string;
  shippingLastName: string;

  /**
   * Initializes a new instance of the DisbursementPayload class.
   * @param src Source to create new DisbursementPayload record from.
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
      this.amount = src.amount;
      this.approvalBy = src.approvalBy;
      this.approvalDateTime = src.approvalDateTime;
      this.catastropheType = src.catastropheType;
      this.costType = src.costType;
      this.coverage = src.coverage;
      this.deliveryMethod = src.deliveryMethod;
      this.description = src.description;
      this.disbursementType = src.disbursementType;
      this.documentKeyList = src.documentKeyList;
      this.lossDateTime = src.lossDateTime;
      this.mailingAddress.loadFromSource(src.mailingAddress);
      this.memberName = src.memberName;
      this.memo = src.memo;
      this.paymentId = src.paymentId;
      this.policyId = src.policyId;
      this.policyNumber = src.policyNumber;
      this.productKey = src.productKey;
      this.reason = src.reason;
      this.referenceId = src.referenceId;
      this.referenceNumber = src.referenceNumber;
      this.referenceType = src.referenceType;
      this.returnEvent = src.returnEvent;
      this.shippingCompanyName = src.shippingCompanyName;
      this.shippingEmail = src.shippingEmail;
      this.shippingFirstName = src.shippingFirstName;
      this.shippingLastName = src.shippingLastName;

      if (src.paymentDetailList) {
        this.paymentDetailList = src.paymentDetailList.map((detail) => new PaymentDetail(detail));
      }

      if (src.recipients) {
        this.recipients = src.recipients.map((recipient) => new Recipient(recipient));
      }
    }
  };
}
