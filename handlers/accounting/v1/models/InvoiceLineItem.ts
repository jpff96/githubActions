import { LineItem } from './LineItem';

/**
 * InvoiceLineItem
 */
export class InvoiceLineItem extends LineItem {
  amountPaid: number = 0;

  /**
   * Initializes a new instance of the @see InvoiceLineItem class.
   * @param data Data to create the object
   */
  constructor(data?: any) {
    super(data);

    if (data) {
      this.amountPaid = data.amountPaid || 0;
    }
  }
}
