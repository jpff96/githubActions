import { AccountingDocType } from '../../../../libs/enumLib';
import { AttributeMap } from './AttributeMap';
import { IBalanceTransaction } from './IBalanceTransaction';
import { LineItem } from './LineItem';

/**
 * Balance Total
 * @class BalanceTotal
 */
export class BalanceTotal implements IBalanceTransaction {
  // Hash Key - policy id transaction belongs to.
  policyId: string;

  // Range Key - Doc type TOTALS - No Date on this document type
  typeDate: string;

  // charge and payment totals
  totalBalanceDue: number = 0;
  balanceDueCount: number = 0;
  balanceDueSubtotals: AttributeMap;

  totalPayments: number = 0;
  paymentCount: number = 0;
  paymentSubtotals: AttributeMap;

  /**
   * Initializes a new instance of the @see {BalanceTotal} class.
   */
  constructor(src?: any) {
    this.typeDate = AccountingDocType.Totals;

    if (src) {
      this.policyId = src.policyId;
      this.typeDate = src.typeDate;

      // Balance due totals
      this.totalBalanceDue = src.totalBalanceDue || 0;
      this.balanceDueCount = src.balanceDueCount || 0;

      for (const account of Object.values(LineItem.AccountType)) {
        this.balanceDueSubtotals[account] = src[`${BalanceTotal.Prefix.BalanceDue}${account}`];
      }

      // Payment totals
      this.totalPayments = src.totalPayments || 0;
      this.paymentCount = src.paymentCount || 0;

      for (const account of Object.values(LineItem.AccountType)) {
        this.paymentSubtotals[account] = src[`${BalanceTotal.Prefix.Payment}${account}`];
      }
    }
  }
}

export namespace BalanceTotal {
  /**
   * Prefix values for subtotals.
   */
  export enum Prefix {
    BalanceDue = 'balanceDue',
    Payment = 'payment'
  }
}
