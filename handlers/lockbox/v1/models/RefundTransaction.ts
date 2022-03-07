import { CostType, DeliveryMethodType, Reasons } from '../../../../libs/enumLib';
import { Recipient } from '../../../disbursement/v1/models';

/**
 * @class RefundTransaction
 */
export class RefundTransaction {
  deliveryMethod: DeliveryMethodType;
  recipients: Array<Recipient>;
  costType: CostType;
  reason?: Reasons;
  /**
   * Initializes a new instance of the @see CheckInvoice class.
   * @param src
   */
  constructor(src?: any) {
    if (src) {
      this.deliveryMethod = src.deliveryMethod;
      this.reason = src.reason || Reasons.RefundedCheck;
      this.costType = src.costType || CostType.PremiumRefund;
      if (src.recipients) {
        this.recipients = src.recipients.map((recipient) => new Recipient(recipient));
      }
    }
  }
}