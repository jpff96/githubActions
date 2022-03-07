import * as math from 'mathjs';
import { evenRound } from '../../../bill2pay/bill2Pay';
import { InvoiceLineItem } from './InvoiceLineItem';
import { LineItem } from './LineItem';
import { LineItems } from './LineItems';

/**
 * Invoice Line Items
 */
export class InvoiceLineItems {
  amountDue: number = 0;
  amountPaid: number = 0;
  description: string = '';
  readonly invoiceLineItems: Array<InvoiceLineItem> = new Array<InvoiceLineItem>();

  /**
   * Initializes a new instance of the @see LineItems class.
   * @param data Data to create the object
   */
  constructor(data?: any) {
    if (data) {
      this.amountPaid = data.amountPaid || 0;
      this.amountDue = data.amountDue || 0;
      this.description = data.description;
      this.invoiceLineItems = data.invoiceLineItems?.map((x) => new InvoiceLineItem(x)) || [];
    }
  }

  /**
   * Adds a new line item and updates the subtotal.
   * @param lineItem Line item to add
   * @returns
   */
  addLineItem = <T extends InvoiceLineItem | LineItem>(lineItem: T) => {
    let myLineItem: InvoiceLineItem;

    if (lineItem?.amount !== 0) {
      myLineItem = this.invoiceLineItems.find(
        (x) => x.account === lineItem.account && x.itemType === lineItem.itemType
      );

      if (myLineItem) {
        // Add to existing line item
        myLineItem.amount = math.round(myLineItem.amount + lineItem.amount, 2);
      } else {
        // Add a new line item
        myLineItem = new InvoiceLineItem(lineItem);

        this.invoiceLineItems.push(myLineItem);
        this.sortByAccountType();
      }

      this.amountDue = math.round(this.amountDue + lineItem.amount, 2);

      if (lineItem instanceof InvoiceLineItem) {
        myLineItem.amountPaid = math.round(myLineItem.amountPaid + lineItem.amountPaid, 2);
        this.amountPaid = math.round(this.amountPaid + lineItem.amountPaid, 2);
      }
    }

    return this;
  };

  /**
   * Subtracts line item from this object.
   * @param lineItem List of line items to add.
   * @returns
   */
  subtractLineItem = <T extends InvoiceLineItem | LineItem>(lineItem: T) => {
    if (lineItem?.amount !== 0) {
      // Check for existing item
      const myLineItem = this.invoiceLineItems.find(
        (x) => x.account === lineItem.account && x.itemType === lineItem.itemType
      );

      if (myLineItem) {
        // Add to existing line item
        myLineItem.amount = math.round(myLineItem.amount - lineItem.amount, 2);
        if (lineItem instanceof InvoiceLineItem) {
          myLineItem.amountPaid = math.round(myLineItem.amountPaid - lineItem.amountPaid, 2);
        }
      } else {
        // Add a new line item
        const newlineItem = new InvoiceLineItem(lineItem);
        newlineItem.amount *= -1;
        this.invoiceLineItems.push(newlineItem);
        this.sortByAccountType();
      }

      this.amountDue = math.round(this.amountDue - lineItem.amount, 2);

      if (lineItem instanceof InvoiceLineItem) {
        this.amountPaid = math.round(this.amountPaid - lineItem.amountPaid, 2);
      }
    }

    return this;
  };

  /**
   * Merges line items into this object.
   * @param lineItems List of line items to add.
   * @returns
   */
  addLineItems = <T extends Array<InvoiceLineItem | LineItem>>(lineItems: T) => {
    for (const lineItem of lineItems) {
      // Check for existing item
      let myLineItem = this.invoiceLineItems.find(
        (x) => x.account === lineItem.account && x.itemType === lineItem.itemType
      );

      if (myLineItem) {
        // Add to existing line item
        myLineItem.amount = math.round(myLineItem.amount + lineItem.amount, 2);
      } else {
        // Add a new line item
        myLineItem = new InvoiceLineItem(lineItem);
        this.invoiceLineItems.push(myLineItem);
      }

      this.amountDue = math.round(this.amountDue + lineItem.amount, 2);

      if (lineItem instanceof InvoiceLineItem) {
        myLineItem.amountPaid = math.round(myLineItem.amountPaid + lineItem.amountPaid, 2);
        this.amountPaid = math.round(this.amountPaid + lineItem.amountPaid, 2);
      }
    }

    this.sortByAccountType();

    return this;
  };

  /**
   * Subtracts line items from this object.
   * @param lineItems List of line items to add.
   * @returns
   */
  subtractLineItems = <T extends Array<InvoiceLineItem | LineItem>>(lineItems: T) => {
    for (const lineItem of lineItems) {
      // Check for existing item
      let myLineItem = this.invoiceLineItems.find(
        (x) => x.account === lineItem.account && x.itemType === lineItem.itemType
      );

      if (myLineItem) {
        // Add to existing line item
        myLineItem.amount = math.round(myLineItem.amount - lineItem.amount, 2);
      } else {
        // Add a new line item
        myLineItem = new InvoiceLineItem(lineItem);
        myLineItem.amount *= -1;
        this.invoiceLineItems.push(myLineItem);
      }

      this.amountDue = math.round(this.amountDue - lineItem.amount, 2);

      if (lineItem instanceof InvoiceLineItem) {
        myLineItem.amountPaid = math.round(myLineItem.amountPaid - lineItem.amountPaid, 2);
        this.amountPaid = math.round(this.amountPaid - lineItem.amountPaid, 2);
      }
    }

    this.sortByAccountType();

    return this;
  };

  /**
   * Applies an amount paid to the invoice line items and updates amount paid
   * @param amount The amount to apply to the invoice line items
   * @param lineItems The lineitems opbject to keep track of what has been paid
   */
  applyToInvoiceLineItems = (amount: number, lineItems?: LineItems) => {
    for (const invoiceLineItem of this.invoiceLineItems) {
      let lineItemAmountPaid = 0;

      if (invoiceLineItem.amount > invoiceLineItem.amountPaid) {
        // If the amount due is greater than the amount paid we have to apply money
        if (amount >= invoiceLineItem.amount - invoiceLineItem.amountPaid) {
          lineItemAmountPaid = evenRound(invoiceLineItem.amount - invoiceLineItem.amountPaid, 2);
          invoiceLineItem.amountPaid = invoiceLineItem.amount;
        } else {
          //If not pay whatever amount you have to that lineItem and update invoiceLineItem and open invoice status.
          lineItemAmountPaid = amount;
          invoiceLineItem.amountPaid += amount;
        }
        amount = evenRound(amount - lineItemAmountPaid, 2);
        this.amountPaid = evenRound(this.amountPaid + lineItemAmountPaid, 2);
      }

      if (lineItems) {
        // We subtract the amount paid so we can keep track of the different line items amount that have been paid
        lineItems.subtractLineItem(
          new LineItem({
            amount: lineItemAmountPaid,
            itemType: invoiceLineItem.itemType,
            account: invoiceLineItem.account,
            writingCompany: invoiceLineItem.writingCompany
          })
        );
      }
    }

    return amount;
  };

  /**
   * Revert payment to invoice
   * @param lineItems The items to revert.
   */
  revertPayment = (lineItems: Array<LineItem>) => {
    for (const lineItem of lineItems) {
      const invoiceLineItem = this.invoiceLineItems.find(
        (x) => x.account === lineItem.account && x.itemType === lineItem.itemType
      );

      if (invoiceLineItem) {
        invoiceLineItem.amountPaid = math.round(invoiceLineItem.amount - lineItem.amount, 2);
      }

      this.amountPaid = evenRound(this.amountPaid - lineItem.amount, 2);
    }
  };

  /**
   * Return the unpaid amount of an invoice.
   */
  getUnpaidAmount = () => {
    return evenRound(this.amountDue - this.amountPaid, 2);
  }

  /**
   * Sorts the line items by account type using the AccountType enumeration as the sort order.
   * @returns Sorted line items
   */
  protected sortByAccountType = () => {
    const sortByObject = Object.values(InvoiceLineItem.AccountType).reduce((obj, item, index) => {
      return {
        ...obj,
        [item]: index
      };
    }, {});

    return this.invoiceLineItems.sort((a, b) => sortByObject[a.account] - sortByObject[b.account]);
  };
}
