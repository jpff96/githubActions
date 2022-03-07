import { parseBool } from '../../../../libs/Utils';
import { BalanceTransaction } from './BalanceTransaction';
import { LineItem } from './LineItem';
import { Payment } from './Payment';

/**
 * Action Request
 * @class ActionRequest
 */
export class ActionRequest {
  action: BalanceTransaction.Action;
  description: string;
  entityId: string;
  lineItem?: LineItem;
  nsfAmount: number;
  isNsf: boolean;
  policyNumber: string;
  processedDateTime?: string;
  termEffectiveDate: string;
  transferPolicyId?: string;
  transferPolicyNumber?: string;
  version: string;
  payment?: Payment;
  reason: string;

  /**
   * Initializes a new instance of the @see {ActionRequest} class.
   * @param src The source record.
   */
  constructor(src?: any) {
    if (src) {
      this.action = src.action;
      this.description = src.description;
      this.entityId = src.entityId;
      this.lineItem = src.lineItem;
      this.nsfAmount = src.nsfAmount;
      this.isNsf = src.isNsf;
      this.policyNumber = src.policyNumber;
      this.processedDateTime = src.processedDateTime;
      this.termEffectiveDate = src.termEffectiveDate;
      this.transferPolicyId = src.transferPolicyId;
      this.transferPolicyNumber = src.transferPolicyNumber;
      this.version = src.version;
      this.reason = src.reason;
      this.payment = new Payment(src.payment);
    }

    this.processedDateTime ??= new Date().toISOString();
  }
}
