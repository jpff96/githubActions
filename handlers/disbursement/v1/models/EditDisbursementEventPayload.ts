import { Recipient } from './Recipient';
import { DisbursementRepository } from '../DisbursementRepository';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';

/**
 * Information used to represent an edit disbursement payload info
 */
export class EditDisbursementEventPayload {
  batchId: string = '';
  batchNumber: string = '';
  disbursementId: string = '';
  disbursementNumber: string = '';
  disbursementType: DisbursementRepository.DisbursementRecordType;
  paymentId: string;
  policyId: string;
  recipients: Array<Recipient> = [];
  referenceId: string;
  referenceNumber: string;
  returnEvent: ServiceEventProducer.DetailType;

  /**
   * Initializes a new instance of the EditDisbursementEventPayload class.
   * @param src Source to create new EditDisbursementEventPayload record from.
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
      this.batchId = src.batchId;
      this.batchNumber = src.batchNumber;
      this.disbursementId = src.disbursementId;
      this.disbursementNumber = src.disbursementNumber;
      this.disbursementType = src.disbursementType;
      this.paymentId = src.paymentId;
      this.policyId = src.policyId;
      this.referenceId = src.referenceId;
      this.referenceNumber = src.referenceNumber;
      this.returnEvent = src.returnEvent;

      if (src.recipients) {
        this.recipients = src.recipients.map((recipient) => new Recipient(recipient));
      }
    }
  };
}
