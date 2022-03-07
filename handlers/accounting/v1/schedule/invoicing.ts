import { ScheduledEvent, ScheduledHandler } from 'aws-lambda';
import { addDays, compareDesc, formatISO, parseISO } from 'date-fns';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { ProductAPI } from '../../../../libs/API/ProductAPI';
import { client } from '../../../../libs/dynamodb';
import { generateStatementEvent } from '../../../../libs/Utils';
import { BillingRepository } from '../BillingRepository';
import { Billing } from '../models/Billing';
import { BillingStatus } from '../models/BillingStatus';
import { Installment } from '../models/Installment';
import { Invoice } from '../models/Invoice';
import { Lock } from '../models/Lock';
import { logError, logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import { PaymentPlan } from '../models/PaymentPlan';
import { clearPaymentAttempted } from '../business/invoicing';

/**
 * Main entry point for the invoice job.
 * @param event Event data.
 */
export const main: ScheduledHandler = async (event: ScheduledEvent): Promise<void> => {
  try {
    let lock: Lock;
    let lockStatus = BillingStatus.StatusType.InProcess;

    // TODO - create invoices that are due to be created/sent
    const repository = new BillingRepository(client);

    //This magic string brings all products because is the highest hierarchy
    const products = await ProductAPI.getProductList();

    for (const productKey of products) {
      try {
        const [productMain, ProductAccounting] = await ProductAPI.getConfiguration(productKey);
        // const days = ProductAccounting.invoiceDaysBeforeDueDate...
        const days = 30;
        const dueDate = addDays(new Date(), days);
        let lastEvaluatedKey;

        do {
          const policyList = await repository.getByDueDate(productKey, dueDate, 10, lastEvaluatedKey);
          lastEvaluatedKey = policyList.lastEvaluatedKey;

          for (const policyId of policyList.policies) {
            try {
              lock = await repository.lock(policyId, lockStatus);
              if (lock) {
                const billing = await repository.get(policyId);
                await generateInvoice(policyId, billing);
                await generateStatementEvent(policyId, billing);
                await repository.save(billing);

                const invoices = await repository.getAllInvoices(policyId);
                const updatedInvoices = await clearPaymentAttempted(invoices);
                await repository.saveInvoices(updatedInvoices);

                lockStatus = BillingStatus.StatusType.None;
              }
            } catch (ex) {
              // Log error, but go on to the next policy
              logError(console.log, ex, 'Unable to create invoices');
              lockStatus = BillingStatus.StatusType.Error;
            } finally {
              if (lock) {
                await repository.unlock(policyId, lockStatus);
              }
            }
          }
        } while (lastEvaluatedKey);
      } catch (ex) {
        // Log error, but go on to the next product
        logError(console.log, ex, 'Unable to create invoices');
      }
    }
  } catch (ex) {
    logError(console.log, ex, 'Unable to create invoices');
    throw ex;
  }
};

const isInInvoicingRange = (dueDate: string) => {
  // TODO: 30 days must be pulled form product configuration
  const billingRange = parseISO(formatISO(addDays(new Date(), 30), { representation: 'date' }));
  // if the dueDate passed in is before the billing range (30 days from then day the cronjob runs) then it returns true, otherwise it returns false
  const isWithinInvoicingRange = compareDesc(parseISO(dueDate), billingRange) === -1 ? false : true;
  return isWithinInvoicingRange;
};

// TODO - move this to business area to process the billing record and start
// the async process to generate an invoice.
export const generateInvoice = async (policyId: string, billing: Billing) => {
  const status = BillingStatus.InvoiceStatus.Sent;
  const elevenPayPlan = PaymentPlan.PaymentPlanType.ElevenPay;
  const responsibleParty = PaymentPlan.ResponsibleParty.Insured;
  const repository = new BillingRepository(client);

  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');
  logTrace(loggerInfo, '🚀', 'invoicing-billing-before-updating', billing);

  const invoiceStatus = billing.billingStatus.invoiceStatus;
  const billingPaymentPlan = billing.paymentPlan.planType;
  const billingResponsibleParty = billing.paymentPlan.responsibleParty;
  // Invoice should not be generated if there is a lock set, if the invoice has already been sent
  // if the payment status of the policy isn't in process (means that its not done or just initiated) or if there are no installments left

  logTrace(loggerInfo, '🚀', 'invoicing-lockStatus-before-locking', billing.billingStatus.lockStatus);

  if (
    invoiceStatus !== status &&
    billingPaymentPlan === elevenPayPlan &&
    billingResponsibleParty === responsibleParty &&
    billing.paymentDetail.installmentsLeft !== 0
  ) {
    for (const installment of billing.paymentDetail.listOfInstallments) {
      logTrace(loggerInfo, '🚀', 'invoicing-installment-loop', installment);

      const invoiceCreated = installment.invoiceCreated;
      const billedInvoice = isInInvoicingRange(installment.dueDate);
      if (!invoiceCreated && billedInvoice) {
        await addNewInvoiceFromInstallments(billing, installment);

        installment.invoiceCreated = true;
        billing.billingStatus.invoiceStatus = BillingStatus.InvoiceStatus.Sent;

        // Remove comment when DocumentAPI handles this event
        //ServiceEventProducer.sendServiceEvent(invoice, ServiceEventProducer.DetailType.InvoiceCreate);

        await ActivityLogProducer.sendActivityLog(
          // TODO - Investigue business rules to generate proper activity log
          billing.pk,
          billing.agencyEntityId,
          'Installment Invoice created for policy: {{ policyId }}',
          {
            policyId: billing.pk
          }
        );
      }
    }
    logTrace(loggerInfo, '🚀', 'invoicing-billing-after-updating', billing);

    await repository.save(billing);
  }
};

/**
 * Creates Invoice for Eleven Pay from Installment
 * @param billing billing data.
 * @param installment Installment data.
 *
 * @returns array of invoices on billing.
 */
export const addNewInvoiceFromInstallments = async (billing: Billing, installment: Installment) => {
  const billingRepo = new BillingRepository(client);
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');
  let isFirstDownPayment = installment.installmentNumber === 1 ? true : false;

  const invoice = new Invoice({
    invoiceType: isFirstDownPayment ? Invoice.InvoiceType.FirstDownPayment : Invoice.InvoiceType.Installment,
    dueDate: installment.dueDate,
    pk: billing.pk,
    policyNumber: billing.policyNumber,
    productName: billing.productKey,
    paymentStatus: Invoice.PaymentStatus.Pending,
    installmentNumber: installment.installmentNumber,
    providerFee: 0,
    amountPaid: 0,
    installmentFee: installment.installmentFee
  });

  await invoice.generateInvoiceNumber(billing.ownerEntityId);

  invoice.addLineItems(installment.lineItems);
  logTrace(loggerInfo, '🚀', 'invoicing-invoice-creating-before-saving', invoice);

  await billingRepo.saveInvoice(invoice);

  return invoice;
};
