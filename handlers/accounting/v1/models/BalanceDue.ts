import { formatISO } from 'date-fns';
import * as math from 'mathjs';
import { LineItem } from './LineItem';
import { LineItems } from './LineItems';

/**
 * BalanceDue
 * @extends LineItems
 */
export class BalanceDue extends LineItems {
  balanceType: string;
  createDate: string = formatISO(new Date(), { representation: 'date' });
  dueDate: string;
  effectiveDate: string;
  policyNumber: string;
  version: string;
  reason: string;
  paymentReference: string;

  /**
   * Initializes a new instance of the @see BalanceDue class.
   * @param data Data to create the object
   */
  constructor(data?: any) {
    super(data);

    if (data) {
      this.balanceType = data.balanceType;
      this.createDate = data.createDate || formatISO(new Date(), { representation: 'date' });
      this.dueDate = data.dueDate;
      this.effectiveDate = data.effectiveDate;
      this.policyNumber = data.policyNumber;
      this.paymentReference = data.paymentReference;
      this.reason = data.reason;
      this.version = data.version;
    }
  }

  /**
   * Takes a specified amount from the balance due provided
   * @param percentage The percentage to take from each line item
   * @returns The updated balanceDue
   */
  getPercentageFromBalanceDueLineItems = (percentage: number) => {
    const newLineItems = new LineItems();
    for (const lineItem of this.lineItems) {
      if (lineItem.amount !== 0 && percentage !== 0) {
        const absoluteLineItemAmount = math.abs(lineItem.amount);
        const amount = (absoluteLineItemAmount * percentage) / 100;

        const newLineItem = new LineItem({
          amount: amount,
          account: lineItem.account,
          itemType: lineItem.itemType,
          writingCompany: lineItem.writingCompany
        });

        newLineItems.addLineItem(newLineItem);
      }
    }
    return newLineItems;
  };
}
