import { VPayRecordType } from '../../../../libs/enumLib';

/**
 * Information used to represent scheduled reference object info
 */
export class VPayReference {
  readonly recordType: string = VPayRecordType.Reference;

  paymentId: string;
  referenceNumber: string;
  memberName: string;
  policyNumber: string;
  coverage: string;
  memo: string;
  paymentType: string;
  lossDateTime: string;
  adjuster: string;
  reason: string;

  /**
   * Initializes a new instance of the VPayReference class.
   * @param src Source to create new VPayReference record from.
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
      this.paymentId = src.paymentId;
      this.referenceNumber = src.referenceNumber;
      this.memberName = src.memberName;
      this.policyNumber = src.policyNumber;
      this.coverage = src.coverage;
      this.memo = src.memo;
      this.paymentType = src.paymentType;
      this.lossDateTime = src.lossDateTime || '';
      this.adjuster = src.adjuster;
      this.reason = src.reason;
    }
  };
}
