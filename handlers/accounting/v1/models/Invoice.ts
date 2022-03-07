import { formatISO } from 'date-fns';
import { client } from '../../../../libs/dynamodb';
import { BillingRepository } from '../BillingRepository';
import { InvoiceLineItems } from './InvoiceLineItems';

/**
 * Invoice
 * @class Invoice
 */
export class Invoice extends InvoiceLineItems {
  pk: string; // policy Id
  sk: string = ''; //Invoice_'InvoiceNumber'
  invoiceType: Invoice.InvoiceType;
  invoiceNumber: string;
  providerFee: number;
  dueDate: string;
  transactionDateTime: string;
  policyNumber: string;
  installmentNumber: number;
  paymentMethod: string;
  productName: string;
  paymentStatus: Invoice.PaymentStatus = Invoice.PaymentStatus.Pending;
  createDate: string = formatISO(new Date(), { representation: 'date' });
  paymentAttempted = false;

  /**
   * Initializes a new instance of the @see {Invoice} class.
   * @param src The source record.
   */
  constructor(src?: any) {
    super(src);

    if (src) {
      this.pk = src.pk;
      this.sk = src.sk;
      this.providerFee = src.providerFee;
      this.dueDate = src.dueDate;
      this.installmentNumber = src.installmentNumber || 0;
      this.transactionDateTime = src.transactionDateTime || '';
      this.createDate = src.createDate || formatISO(new Date(), { representation: 'date' });
      this.paymentMethod = src.paymentMethod;
      this.productName = src.productName;
      this.paymentStatus = src.paymentStatus || Invoice.PaymentStatus.Pending;
      this.invoiceNumber = src.invoiceNumber;
      this.invoiceType = src.invoiceType;
      this.policyNumber = src.policyNumber;
      this.paymentAttempted = src.paymentAttempted || false;
    }
  }

  /**
   * Creates a new invoice setting next available invoice number
   * @param entityId
   * @param policyId
   * @param invoiceType
   * @param policyNumber
   * @param productName
   * @returns
   */
  public static createNewInvoice = async (
    entityId: string,
    policyId: string,
    invoiceType: Invoice.InvoiceType,
    policyNumber: string,
    productName: string,
    dueDate: string
  ) => {
    const billingRepo = new BillingRepository(client);
    const invoiceNumber = (await billingRepo.getNextInvoiceNumber(entityId)).toString();

    return new Invoice({
      entityId: entityId,
      invoiceNumber: invoiceNumber,
      invoiceType: invoiceType,
      dueDate: dueDate,
      pk: policyId,
      policyNumber: policyNumber,
      productName: productName
    });
  };

  /**
   * Generates the invoice number for this invoice by getting the next sequence number for the
   * entity.
   * @param entityId The entity id.
   */
  async generateInvoiceNumber(entityId: string) {
    const billingRepo = new BillingRepository(client);
    // TODO - add prefix or suffix as needed.
    this.invoiceNumber = (await billingRepo.getNextInvoiceNumber(entityId)).toString();
  }
}

export namespace Invoice {
  /**
   * Status used for CRON job record locks/status
   */
  export enum InvoicingStatusType {
    Error = 'Error',
    InvoiceSent = 'InvoiceSent',
    None = 'None',
    Paid = 'Paid'
  }

  /**
   * Invoice status
   */
  export enum PaymentStatus {
    Paid = 'Paid',
    Pending = 'Pending',
    Void = 'Void',
    Closed = 'Closed',
    Applied = 'Applied'
  }

  export enum InvoiceType {
    BillMyLender = 'Bill My Lender',
    FirstDownPayment = 'First Down Payment',
    FullPremiumPayment = 'Full Premium Payment',
    Installment = 'Installment',
    InstallmentFee = 'Installment Fee',
    MidTermChange = 'MidTerm Change',
    Nsf = 'Nsf',
    PremiumPayment = 'Premium Payment',
    Refund = 'Refund',
    Reinstatement = 'Reinstatement',
    WriteOff = 'Write off',
    CreditMemo = 'Credit Memo'
  }
}
