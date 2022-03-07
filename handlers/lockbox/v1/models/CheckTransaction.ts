import { CostType, DeliveryMethodType } from '../../../../libs/enumLib';
import { Recipient } from '../../../disbursement/v1/models';
import { CheckInvoice } from './CheckInvoice';
import { Image } from './Image';

/**
 * @class CheckTransaction
 */
export class CheckTransaction {
  checkNumber: number = 0;
  checkAmount: number = 0;
  postMarkDate: string = '';
  images: Array<Image> = [];
  reason?: string;
  amount: number = 0;
  invoiceNumber: string = '';
  loanNumber: string = '';
  policyId: string = '';
  policyNumber: string = '';
  isMortgagee: boolean = false;
  dueDate: string = '';
  appliedDate: string = '';
  transactionId: string = '';
  referenceId: string = '';
  status = CheckTransaction.Status.Suspense;
  note: string = '';
  errors: Array<CheckTransaction.MatchErrors> = new Array<CheckTransaction.MatchErrors>();
  invoice?: CheckInvoice = null;
  recipients?: Array<Recipient>;
  deliveryMethod?: DeliveryMethodType;
  costType?: CostType;
  referenceNumber?: string = '';

  /**
   * Initializes a new instance of the @see CheckTransaction class.
   * @param src
   */
  constructor(src?: any) {
    if (src) {
      this.checkAmount = src.checkAmount;
      this.checkNumber = src.checkNumber;
      this.postMarkDate = src.postMarkDate;
      this.images = src.images;
      this.amount = src.amount;
      this.invoiceNumber = src.invoiceNumber;
      this.loanNumber = src.loanNumber;
      this.policyId = src.policyId;
      this.policyNumber = src.policyNumber;
      this.isMortgagee = src.isMortgagee;
      this.dueDate = src.dueDate;
      this.appliedDate = src.appliedDate;
      this.transactionId = src.transactionId;
      this.referenceId = src.referenceId;
      this.status = src.status;
      this.note = src.note;
      this.errors = src.errors;

      if (src.recipients) {
        this.recipients = src.recipients.map((recipient) => new Recipient(recipient));
      }
    }
  }
}

export namespace CheckTransaction {
  /**
   * Status type values.
   */
  export enum Status {
    Approved = 'Approved',
    Matched = 'Matched',
    Suspense = 'Suspense',
    Applied = 'Applied',
    RefundProcessed = 'RefundProcessed',
    RefundApproved = 'RefundApproved'
  }

  /**
   * Action type values.
   */
  export enum Action {
    Approve = 'Approve',
    Update = 'Update',
    Reset = 'Reset',
    Refund = 'Refund'
  }

  /**
   * Match Error values.
   */
  export enum MatchErrors {
    PolicyId = 'Policy',
    Invoice = 'Invoice',
    LoanNumber = 'LoanNumber',
    Amount = 'Amount'
  }
}
