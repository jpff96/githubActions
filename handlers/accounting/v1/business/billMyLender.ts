import { formatISO } from 'date-fns';
import { client } from '../../../../libs/dynamodb';
import Tenant from '../../../../libs/Tenant';
import { generateStatementEvent } from '../../../../libs/Utils';
import { BillingRepository } from '../BillingRepository';
import { BalanceDue } from '../models/BalanceDue';
import { Billing } from '../models/Billing';
import { Invoice } from '../models/Invoice';

/**
 * Handle Midterm Change payment
 * @param policyId The policyId.
 * @param mainBalanceDue The Main Balance Due.
 * @param companionBalanceDue The Companion Balance Due.
 */
export const handleMidtermChangeMortgageePayment = async (
  policyId: string,
  mainBalanceDue: BalanceDue,
  companionBalanceDue: BalanceDue = null,
  billing: Billing
) => {
  const billingRepo = new BillingRepository(client);

  const invoice = await Invoice.createNewInvoice(
    billing.ownerEntityId,
    policyId,
    Invoice.InvoiceType.MidTermChange,
    billing.policyNumber,
    billing.pk,
    formatISO(new Date(), { representation: 'date' })
  );

  invoice.addLineItems(mainBalanceDue.lineItems);

  if (companionBalanceDue && companionBalanceDue.subtotal !== 0) {
    invoice.addLineItems(companionBalanceDue.lineItems);
  }

  await billingRepo.saveInvoice(invoice);
};
