import { Recipient } from './Recipient';
import { DisbursementRepository } from '../DisbursementRepository';
import { Reasons } from '../../../../libs/enumLib';
import { DisbursementState } from './DisbursementState';

/**
 * @class DisbursementResponse
 */
export class DisbursementResponse {
  disbursementId: string = ''; // entityId_disbursementId
  disbursementType: DisbursementRepository.DisbursementRecordType =
    DisbursementRepository.DisbursementRecordType.Disbursement;

  releasedDateTime: string;
  scheduledDateTime: string = '';
  amount: number = 0;
  approvalBy: string = '';
  approvalDateTime: string = '';
  batchId: string = '';
  batchNumber: string = '';
  createdDateTime: string = '';
  disbursementNumber: string = '';
  docTypeNumber: string = ''; // For EntityIndex
  policyId: string = '';
  policyNumber: string = '';
  reason: Reasons = Reasons.Other;
  state: DisbursementState = new DisbursementState();
  lastActionBy: string = '';
  lastActionDate: string = '';
  recipients: Array<Recipient> = [];

  /**
   * Initializes a new instance of the @see DisbursementResponse class.
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
      this.disbursementId = src.pk;
      this.disbursementType = src.sk;

      this.amount = src.amount;
      this.approvalBy = src.approvalBy;
      this.approvalDateTime = src.approvalDateTime;
      this.batchId = src.batchId;
      this.batchNumber = src.batchNumber;
      this.createdDateTime = src.createdDateTime;
      this.disbursementNumber = src.disbursementNumber;
      this.docTypeNumber = src.docTypeNumber;
      this.lastActionBy = src.lastActionBy;
      this.lastActionDate = src.lastActionDate;
      this.policyId = src.policyId;
      this.policyNumber = src.policyNumber;
      this.reason = src.reason || Reasons.Other;
      this.releasedDateTime = src.releasedDateTime;
      this.scheduledDateTime = src.scheduledDateTime;
      this.state.loadFromSource(src.state);

      if (src.recipients) {
        this.recipients = src.recipients.map((recipient) => new Recipient(recipient));
      }
    }
  };
}
