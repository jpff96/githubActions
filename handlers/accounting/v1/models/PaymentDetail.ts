import * as math from 'mathjs';
import { Invoice } from './Invoice';
import { PaymentPlan } from './PaymentPlan';
import { LineItem } from './LineItem';
import { Installment } from './Installment';

/**
 * PaymentDetail
 * @class PaymentDetail
 */
export class PaymentDetail {
  invoiceStatus: Invoice.InvoicingStatusType = Invoice.InvoicingStatusType.None;
  amountDue: number = 0;
  firstDownPayment?: number;
  paymentPlan: PaymentPlan;
  installmentsLeft?: number;
  totalAmountPaid?: number = 0;
  installmentsPaymentAmount?: number;
  installmentFee?: number;
  providerFee: number = 0;
  lineItems: Array<LineItem> = new Array<LineItem>();
  isFirstPayment: boolean = true;
  paymentCompleted: boolean = false;
  listOfInstallments: Array<Installment> = new Array<Installment>();
  transactionToken: string;
  listOfVoidedInvoices: Array<string> = [];

  // TODO - remove when FE can catch up with model changes
  invoices?: Array<Invoice>;

  /**
   * Initializes a new instance of the @see {PaymentDetail} class.
   * @param src The source record.
   */
  constructor(src?: any) {
    if (src) {
      this.amountDue = src.amountDue || 0;
      this.firstDownPayment = src.firstDownPayment || 0;
      this.paymentPlan = src.paymentPlan || '';
      this.installmentsLeft = src.installmentsLeft;
      this.totalAmountPaid = src.totalAmountPaid || 0;
      this.installmentsPaymentAmount = src.installmentsPaymentAmount || 0;
      this.installmentFee = src.installmentFee || 0;
      this.lineItems = src.lineItems?.map((elem) => new LineItem(elem)) || [];
      this.listOfInstallments = src.listOfInstallments?.map((elem) => new Installment(elem)) || [];
      this.listOfVoidedInvoices = src.listOfVoidedInvoices || [];
      this.providerFee = src.providerFee || 0;
      this.isFirstPayment = src.isFirstPayment;
      this.paymentCompleted = src.paymentCompleted;
      this.transactionToken = src.transactionToken;
    }
  }

  /**
   * Adds a new line item and updates the subtotal.
   * @param lineItem Line item to add
   * @returns
   */
  addLineItem = (lineItem: LineItem) => {
    let internalLineItem: LineItem;

    if (lineItem.amount !== 0) {
      internalLineItem = this.lineItems.find((x) => x.account === lineItem.account && x.itemType === lineItem.itemType);

      if (internalLineItem) {
        // Add to existing line item
        internalLineItem.amount = math.round(internalLineItem.amount + lineItem.amount, 2);
      } else {
        // Add a new line item
        internalLineItem = new LineItem();
        internalLineItem.account = lineItem.account;
        internalLineItem.amount = lineItem.amount;
        internalLineItem.itemType = lineItem.itemType;
        internalLineItem.writingCompany = lineItem.writingCompany;

        this.lineItems.push(internalLineItem);
        this.sortByAccountType();
      }

      this.amountDue = math.round(this.amountDue + lineItem.amount, 2);
    }

    return this;
  };

  /**
   * Sorts the line items by account type using the AccountType enumeration as the sort order.
   * @returns Sorted line items
   */
  private sortByAccountType = () => {
    const sortByObject = Object.values(LineItem.AccountType).reduce((obj, item, index) => {
      return {
        ...obj,
        [item]: index
      };
    }, {});

    return this.lineItems.sort((a, b) => sortByObject[a.account] - sortByObject[b.account]);
  };
}
