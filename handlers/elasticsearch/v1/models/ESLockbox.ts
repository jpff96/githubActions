import { providers } from '../../../../libs/enumLib';
import { parseESDateValue, parseESValue } from '../../../../libs/Utils';
import { CheckTransaction } from '../../../lockbox/v1/models/CheckTransaction';

/**
 * ESLockbox
 */
export class ESLockbox {
  key: string;
  entityId: string;
  agencyEntityIds: any;
  processedDate: string;
  postmarkDate: string;
  invoiceNumber: string;
  loanNumber: string;
  checkNumber: string;
  status: string;
  amount: string;
  checkAmount: string;
  remainingBalance: string;
  paymentType: string;

  constructor(entityId: string, processDate: string, transaction: CheckTransaction, ancestors: Array<string>) {
    this.key = parseESValue(transaction.policyNumber);
    this.entityId = parseESValue(entityId.replace(/-/g, ''));
    this.agencyEntityIds = ancestors || [];
    this.processedDate = parseESDateValue(processDate);
    this.postmarkDate = parseESDateValue(transaction.postMarkDate);
    this.invoiceNumber = parseESValue(transaction.invoiceNumber);
    this.loanNumber = parseESValue(transaction.loanNumber);
    this.checkNumber = parseESValue(transaction.checkNumber);
    this.status = parseESValue(transaction.status);
    this.amount = parseESValue(transaction.amount);
    this.checkAmount = parseESValue(transaction.checkAmount);
    this.remainingBalance = parseESValue(Number(transaction.amount) - Number(transaction.checkAmount));
    this.paymentType = providers.Lockbox;
  }
}
