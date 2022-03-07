import { DisbursementRepository } from '../DisbursementRepository';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { Disbursement } from './Disbursement';

/**
 * Information used to represent an edit disbursement payload info
 */
export class DisbursementActionPayload {
  disbursementId: string = '';
  action: Disbursement.Actions;
  disbursementType: DisbursementRepository.DisbursementRecordType;
  paymentId: string = '';
  rejectReason: string = '';
  returnEvent: ServiceEventProducer.DetailType;

  /**
   * Initializes a new instance of the DisbursementActionPayload class.
   * @param src Source to create new DisbursementActionPayload record from.
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
      this.disbursementId = src.disbursementId;
      this.action = src.action;
      this.disbursementType = src.disbursementType;
      this.paymentId = src.paymentId;
      this.rejectReason = src.rejectReason;
      this.returnEvent = src.returnEvent;
    }
  };
}
