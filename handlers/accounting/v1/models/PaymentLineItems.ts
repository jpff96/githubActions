import * as math from 'mathjs';
import { LineItem } from './LineItem';
import { LineItems } from './LineItems';

/**
 * PaymentLineItems
 */
export class PaymentLineItems {
  subtotal: number = 0;
  description: string = '';
  readonly details: Array<LineItems> = new Array<LineItems>();

  /**
   * Initializes a new instance of the @see PaymentLineItems class.
   * @param data Data to create the object
   */
  constructor(data?: any) {
    if (data) {
      this.subtotal = data.subtotal;
      this.description = data.description;
      this.details = data.details?.map((x: any) => new LineItems(x)) || new Array<LineItems>();
    }
  }

  /**
   * Gets the subtotal of all detail items.
   */
  public get getSubtotal() {
    return (this.subtotal = math.round(
      this.details.reduce((total, li) => (total += li.subtotal), 0),
      2
    ));
  }

  /**
   * Adds a new line item and updates the subtotal.
   * @param invoiceNumber The invoice number.
   * @returns
   */
  addInvoice = (invoiceNumber: string) => {
    let lineItems = this.details.find((x) => x.invoiceNumber === invoiceNumber);

    if (!lineItems) {
      lineItems = new LineItems({ invoiceNumber: invoiceNumber });
      this.details.push(lineItems);
    }

    return lineItems;
  };

  /**
   * Adds a new line item and updates the subtotal.
   * @param invoiceNumber The invoice number.
   * @param lineItem Line item to add
   * @returns
   */
  addLineItem = (invoiceNumber: string, lineItem: LineItem) => {
    let lineItems = this.details.find((x) => x.invoiceNumber === invoiceNumber);

    if (lineItems) {
      lineItems.addLineItem(lineItem);
    } else {
      lineItems = new LineItems();
      lineItems.invoiceNumber = invoiceNumber;
      lineItems.addLineItem(lineItem);

      this.details.push(lineItems);
    }

    this.subtotal = this.getSubtotal;
  };

  /**
   * Subtracts line item from this object.
   * @param invoiceNumber The invoice number.
   * @param lineItem List of line items to add.
   * @returns
   */
  subtractLineItem = (invoiceNumber: string, lineItem: LineItem) => {
    let lineItems = this.details.find((x) => x.invoiceNumber === invoiceNumber);

    if (lineItems) {
      lineItems.subtractLineItem(lineItem);
    } else {
      lineItems = new LineItems();
      lineItems.invoiceNumber = invoiceNumber;
      lineItems.subtractLineItem(lineItem);

      this.details.push(lineItems);
    }

    this.subtotal = this.getSubtotal;
  };

  /**
   * Merges line items into this object.
   * @param invoiceNumber The invoice number.
   * @param lineItems List of line items to add.
   * @returns
   */
  addLineItems = (invoiceNumber: string, lineItems: Array<LineItem>) => {
    let detail = this.details.find((x) => x.invoiceNumber === invoiceNumber);

    if (detail) {
      detail.addLineItems(lineItems);
    } else {
      detail = new LineItems();
      detail.invoiceNumber = invoiceNumber;
      detail.addLineItems(lineItems);

      this.details.push(detail);
    }

    this.subtotal = this.getSubtotal;
  };

  /**
   * Subtracts line items from this object.
   * @param invoiceNumber The invoice number.
   * @param lineItems List of line items to add.
   * @returns
   */
  subtractLineItems = (invoiceNumber: string, lineItems: Array<LineItem>) => {
    let detail = this.details.find((x) => x.invoiceNumber === invoiceNumber);

    if (detail) {
      detail.subtractLineItems(lineItems);
    } else {
      detail = new LineItems();
      detail.invoiceNumber = invoiceNumber;
      detail.subtractLineItems(lineItems);

      this.details.push(detail);
    }

    this.subtotal = this.getSubtotal;
  };

  /**
   * Negates each item in the list
   * @returns this
   */
  negateLineItems = () => {
    for (const detail of this.details) {
      detail.negateLineItems();
    }

    this.subtotal = this.getSubtotal;
  };

  /**
   * Clears the list of line items
   * @returns this
   */
  clearLineItems = () => {
    this.details.length = 0;

    this.subtotal = this.getSubtotal;
  };

  /**
   * Gets the premium amount of the line items
   * @param accountType Optional accountType
   * @returns The total premium amount within the line items
   */
  getTotalPremiums = (accountType?: LineItem.AccountType) => {
    let totalPremiums = 0;

    for (const detail of this.details) {
      const premiums = detail.lineItems.filter((elem) => {
        if (accountType) {
          return elem.account === accountType && elem.itemType === LineItem.ItemType.Premium;
        } else {
          return elem.itemType === LineItem.ItemType.Premium;
        }
      });

      for (const lineItem of premiums) {
        totalPremiums = math.round(totalPremiums + lineItem.amount, 2);
      }
    }

    return totalPremiums;
  };
}
