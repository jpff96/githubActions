import { LineItems } from "./LineItems";

/**
 * Installment
 * @class Installment
 */
export class Installment extends LineItems {
  dueDate: string;
  installmentNumber: number;
  invoiceCreated: boolean;
  paid: boolean;
  processedDateTime?: string;
  installmentFee: number;
  /**
   * Initializes a new instance of the @see {Installment} class.
   * @param src The source record.
   */
  constructor(src?: any) {
    super(src);

    if (src) {
      this.dueDate = src.dueDate;
      this.installmentNumber = src.installmentNumber;
      this.invoiceCreated = src.invoiceCreated;
      this.paid = src.paid;
      this.installmentFee = src.installmentFee;
      this.processedDateTime = src.processedDateTime;
    }
  }
}