import { AccountingDocType } from '../../../../libs/enumLib';
import { BalanceDue } from './BalanceDue';
import { IBalanceTransaction } from './IBalanceTransaction';
import { Payment } from './Payment';

/**
 * Balance Transaction
 */
export class BalanceTransaction implements IBalanceTransaction {
  // Hash key - policy id
  policyId: string;

  // Range Key - Doc type CHRG or PMNT _ DateTime of transaction
  typeDate: string;
  transactionDateTime: string = '';
  termEffectiveDate: string = '';
  entityId: string = '';

  // Policy version transaction belongs to
  version: string = '';

  // BalanceDue or payment object for this transaction.
  balanceDue?: BalanceDue = null;
  payment?: Payment = null;

  /**
   * Initializes a new instance of the @see {BalanceTransaction} class.
   * @param policyId The policy id.
   * @param entityId The entity id.
   * @param version The policy version.
   * @param transaction The charge or payment transaction to create balance entry.
   * @param termEffectiveDate The term start date.
   */
  constructor(
    policyId: string,
    entityId: string,
    version: string,
    transaction: BalanceDue | Payment,
    termEffectiveDate: string
  ) {
    this.policyId = policyId;
    this.entityId = entityId;
    this.version = version;

    const receiptDateTime = new Date().toISOString();
    this.transactionDateTime = receiptDateTime;
    this.termEffectiveDate = termEffectiveDate;

    if (transaction instanceof BalanceDue) {
      this.typeDate = `${AccountingDocType.Charge}_${receiptDateTime}`;
      this.balanceDue = transaction;
    } else {
      this.typeDate = `${AccountingDocType.Payment}_${receiptDateTime}`;
      this.payment = transaction;
    }
  }
}

export namespace BalanceTransaction {
  /**
   * Action type values.
   */
  export enum Action {
    Nsf = 'Nsf',
    Reversal = 'Reversal',
    Writeoff = 'Writeoff',
    Refund = 'Refund',
    Transfer = 'Transfer',
    ManualPayment = 'ManualPayment'
  }
}
