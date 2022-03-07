import { formatISO } from 'date-fns';
import { client } from '../../../../libs/dynamodb';
import { LineItem } from '../models/LineItem';
import { getOpenAndDueInvoices, getOpenInvoices } from '../../../../libs/Utils';
import { evenRound } from '../../../bill2pay/bill2Pay';
import { BillingRepository } from '../BillingRepository';
import { BalanceDue } from '../models/BalanceDue';
import { Billing } from '../models/Billing';
import { Invoice } from '../models/Invoice';
import { handleInstallmentInvoiceUpdate } from './installment';
import { PaymentPlan } from '../models/PaymentPlan';
import * as math from 'mathjs';
import { InvoiceLineItem } from '../models/InvoiceLineItem';

/**
 * Makes the invoice for the midTermInvoiceCreation
 * @param policyId The policy Id.
 * @param balanceDue The Main balance due object.
 * @param paid flag to create the invoice as paid for credit invoices.
 */
export const midTermInvoiceCreation = async (policyId: string, balanceDue: BalanceDue, paid: boolean = false) => {
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);

  // We need to generate an invoice for this change
  const invoice = await Invoice.createNewInvoice(
    billing.ownerEntityId,
    policyId,
    Invoice.InvoiceType.MidTermChange,
    billing.policyNumber,
    billing.productKey,
    formatISO(new Date(), { representation: 'date' })
  );

  if (paid === true) {
    invoice.paymentStatus = Invoice.PaymentStatus.Paid;
  }

  // We add the balance due line items to the invoice
  invoice.addLineItems(balanceDue.lineItems);

  await billingRepo.saveInvoice(invoice);

  return invoice;
};

/**
 * Updates the invoice
 * @param invoice The invoice to update.
 * @param transactionDateTime The date of the transaction.
 * @returns
 */

export const markInvoicePaid = (invoice: Invoice, transactionDateTime?: string) => {
  if (invoice.amountDue < 0 || invoice.amountDue === invoice.amountPaid) {
    invoice.paymentStatus = Invoice.PaymentStatus.Paid;
    invoice.transactionDateTime = transactionDateTime || formatISO(new Date());
  }
};

/**
 * Reverts a payment applied to an invoice.
 * @param policyId The policy id.
 * @param invoiceNumber The invoice number.
 * @param lineItems The line items to revert.
 * @returns The modified invoice
 */

export const revertInvoicePayment = async (policyId: any, invoiceNumber: string, lineItems: Array<LineItem>) => {
  const billingRepo = new BillingRepository(client);
  const invoice = await billingRepo.getInvoice(policyId, invoiceNumber);

  if (invoice) {
    invoice.paymentStatus = Invoice.PaymentStatus.Pending;
    invoice.revertPayment(lineItems);

    await billingRepo.saveInvoice(invoice);
  }

  return invoice;
};

/**
 * Applies an amount from credit invoices to open and due invoices
 * @param policyId The policyId of the policy
 */
export const applyCreditToInvoices = async (billing: Billing) => {
  const billingRepo = new BillingRepository(client);

  // When the policy is bill my lender get all the open invoices.
  let openInvoices;
  if (billing.paymentPlan.responsibleParty === PaymentPlan.ResponsibleParty.Mortgagee) {
    openInvoices = await getOpenInvoices(billing.pk, true);
  } else {
    openInvoices = await getOpenAndDueInvoices(billing.pk);
  }

  // First we loop through the invoices with credit to apply and then we apply that amount
  // to the invoices with positive amount due.
  const negativeInvoices = openInvoices.filter((invoice) => invoice.amountDue < 0);
  const positiveInvoices = openInvoices.filter((invoice) => invoice.amountDue >= 0);

  let credit = 0;
  for (const invoice of negativeInvoices) {
    credit = evenRound(credit - invoice.getUnpaidAmount(), 2);
    markInvoicePaid(invoice);
    await billingRepo.saveInvoice(invoice);
  }
  for (const invoice of positiveInvoices) {
    const beforeApplying = credit;
    credit = invoice.applyToInvoiceLineItems(credit);
    const afterApplying = evenRound(beforeApplying - credit, 2);
    await handleInstallmentInvoiceUpdate(invoice, billing, formatISO(new Date()), true, afterApplying);

    markInvoicePaid(invoice);
    await billingRepo.saveInvoice(invoice);
  }

  return credit;
};
/**
 * Creates an offset invoice from an existing invoice
 * @param invoice The invoice to offset
 * @param unsavedInvoices The list of unsaved invoices
 */
export const createOffsetInvoice = async (billing: Billing, invoice: Invoice): Promise<Invoice> => {
  const offsetInvoice = await Invoice.createNewInvoice(
    billing.ownerEntityId,
    billing.pk,
    Invoice.InvoiceType.CreditMemo,
    billing.policyNumber,
    billing.productKey,
    formatISO(new Date(), { representation: 'date' })
  );

  for (const invoiceLineItem of invoice.invoiceLineItems) {
    if (invoiceLineItem.amount > invoiceLineItem.amountPaid) {
      // The amount of the offset lineitem should be the difference between the amount and the amountpaid
      const amount = evenRound(invoiceLineItem.amount - invoiceLineItem.amountPaid, 2);
      const tempLineItem = new InvoiceLineItem({
        amount: amount,
        amountPaid: 0,
        itemType: invoiceLineItem.itemType,
        account: invoiceLineItem.account,
        writingCompany: invoiceLineItem.writingCompany
      });
      offsetInvoice.subtractLineItem(tempLineItem);
    }
  }
  return offsetInvoice;
};

/**
 * Closes all open invoices and adds the offset invoice
 * @param billing The billing Record
 * @param unsavedInvoices The list of invoices kept in memory
 */
export const closeOpenInvoices = async (billing: Billing): Promise<Array<Invoice>> => {
  const unsavedInvoices: Array<Invoice> = [];
  const invoices = await getOpenInvoices(billing.pk);
  for (const invoice of invoices) {
    const offsetInvoice = await createOffsetInvoice(billing, invoice);
    invoice.applyToInvoiceLineItems(math.abs(offsetInvoice.amountDue));
    offsetInvoice.paymentStatus = Invoice.PaymentStatus.Applied;
    unsavedInvoices.push(offsetInvoice);
    invoice.paymentStatus = Invoice.PaymentStatus.Closed;
    invoice.transactionDateTime = formatISO(new Date());
    unsavedInvoices.push(invoice);
  }

  return unsavedInvoices;
};


/**
 * Clears the paymentAttempted flag from open invoices
 * @invoices The list of invoices to clear the flag
 */
export const clearPaymentAttempted = (invoices: Array<Invoice>) => {
  for (const invoice of invoices) {
    if (invoice.paymentStatus === Invoice.PaymentStatus.Pending) {
      invoice.paymentAttempted = false;
    }
  }
  return invoices;
};