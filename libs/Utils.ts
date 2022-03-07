import { subDays, formatISO, parseISO, isEqual, isBefore } from 'date-fns';
import { BalanceRepository } from '../handlers/accounting/v1/BalanceRepository';
import { BillingRepository } from '../handlers/accounting/v1/BillingRepository';
import { Billing } from '../handlers/accounting/v1/models/Billing';
import { BalanceDue } from '../handlers/accounting/v1/models/BalanceDue';
import { BalanceTransaction } from '../handlers/accounting/v1/models/BalanceTransaction';
import { PaymentPlan } from '../handlers/accounting/v1/models/PaymentPlan';
import { Statement } from '../handlers/accounting/v1/models/Statement';
import { Invoice } from '../handlers/accounting/v1/models/Invoice';
import { InvoiceLineItem } from '../handlers/accounting/v1/models/InvoiceLineItem';
import { LineItems } from '../handlers/accounting/v1/models/LineItems';
import { Payment } from '../handlers/accounting/v1/models/Payment';
import { PaymentInformation } from '../handlers/accounting/v1/models/PaymentInformation';
import { saveDefaultPaymentMethod } from '../handlers/accounting/v1/payments/setDefaultPaymentMethod';
import { Bill2Pay, evenRound } from '../handlers/bill2pay/bill2Pay';
import { DefaultPaymentMethod } from '../handlers/bill2pay/models/DefaultPaymentMethod';
import { IDocumentCreateKeyInfo } from '@eclipsetechnology/document-library/dist/@types/IDocumentCreateKeyInfo';
import { ServiceEventProducer } from '../libs/ServiceEventProducer';
import { client } from './dynamodb';
import { AccountingDocType, PaymentTypes } from './enumLib';
import { scanline } from '../libs/scanlineProducer';
import Tenant from './Tenant';
import { ArgumentError, ErrorCodes } from './errors';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import { logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { handleInstallmentInvoiceUpdate } from '../handlers/accounting/v1/business/installment';
import { markInvoicePaid } from '../handlers/accounting/v1/business/invoicing';
import { Installment } from '../handlers/accounting/v1/models/Installment';
import { PaymentNames } from '../libs/constLib';

/**
 * Get Payment Type
 * @param paymentType The paymentType of the payment made C, E or H.
 * @returns A string with the correct verbiage for the paymentType
 */
export const getPaymentType = (paymentType: string): PaymentTypes => {
  let result: PaymentTypes;

  switch (paymentType) {
    case 'C':
      result = PaymentTypes.CREDIT_CARD;
      break;
    case 'A':
      result = PaymentTypes.ECHECK;
      break;
    case 'H':
      result = PaymentTypes.CHECK;
      break;
    default:
      throw new Error('Wrong Payment Type');
  }

  return result;
};

/**
 * Get Payment Plan for Activity Log
 * @param paymentPlan The paymentPlan of the policy
 * @returns A string with the natural language verbiage for the paymentPlan
 */
export const mapPaymentPlan = (paymentPlan: PaymentPlan) => {
  const { planType, responsibleParty } = paymentPlan || {};
  let mappedPaymentPlan = '';
  switch (responsibleParty) {
    case PaymentPlan.ResponsibleParty.Insured:
      mappedPaymentPlan =
        planType === PaymentPlan.PaymentPlanType.FullPay
          ? PaymentNames.INSURED_BILL_ANNUALLY
          : PaymentNames.INSURED_BILL_MONTHLY;
      break;
    case PaymentPlan.ResponsibleParty.Mortgagee:
      mappedPaymentPlan = PaymentNames.LENDER_BILL;
      break;
    default:
      break;
  }
  return mappedPaymentPlan;
};

/**
 * Receives a date and returns whether or not it is in the future
 * @param date The date to check
 */
export const isDue = (date: string) => {
  return isEqual(new Date(date), new Date()) || isBefore(new Date(date), new Date());
};

/**
 * Save the last payment method used
 * @param policyId The policyId
 */
export const saveLastPaymentMethodUsed = async (policyId: string) => {
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);
  const bill2pay = new Bill2Pay();

  const paymentMethod = await bill2pay.listPaymentMethods(billing.userInformation.customerId, Tenant.tenantEntityId);
  const lastPaymentMethodUsed = paymentMethod.listOfMethods.pop();

  const defaultPaymentMethod = new DefaultPaymentMethod({
    nickName: lastPaymentMethodUsed['NickName'],
    token: lastPaymentMethodUsed['Token'],
    type: lastPaymentMethodUsed['Type'],
    expirationDate: lastPaymentMethodUsed['ExpirationDate']
  });

  await saveDefaultPaymentMethod(policyId, defaultPaymentMethod);
};

/**
 * Gets the information of a payment using a transaction token
 * @param policyId The token to fetch the information
 */
export const getPaymentInformation = async (policyId: string, reinstatementPayment: boolean = false) => {
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);
  const bill2pay = new Bill2Pay();

  const token = billing.paymentDetail.transactionToken;
  const paymentInformation = await bill2pay.getPaymentStatus(token, billing.ownerEntityId);

  const result = new PaymentInformation(paymentInformation);
  return result;
};

/**
 * Creates a new transaction in the database with the new data
 * @param balanceDue Incoming balance due object
 * @param policyId The policy id
 * @param entityId The entity id
 * @param termEffectiveDate The term effective date
 * @returns A new BalanceDue object
 */
export const recordBalanceDue = async (
  balanceDue: BalanceDue,
  policyId: string,
  entityId: string,
  termEffectiveDate: string
) => {
  if (balanceDue.subtotal !== 0) {
    const repository = new BalanceRepository(client);
    const balanceDueTransaction = new BalanceTransaction(
      policyId,
      entityId,
      balanceDue.version,
      balanceDue,
      termEffectiveDate
    );
    return await repository.createTransaction(balanceDueTransaction);
  }
};

/**
 * Creates a new transaction in the database with the new data
 * @param payment Incoming payment object
 * @param policyId The policy id
 * @param entityId The entity id
 * @param version The policy version at time of payment
 * @param termEffectiveDate The term effective date
 * @returns A new Payment object
 */
export const recordPayment = async (
  payment: Payment,
  policyId: string,
  entityId: string,
  version: string,
  termEffectiveDate: string
) => {
  if (payment.subtotal !== 0) {
    const repository = new BalanceRepository(client);
    const balanceDueTransaction = new BalanceTransaction(policyId, entityId, version, payment, termEffectiveDate);
    return await repository.createTransaction(balanceDueTransaction);
  }
};

/**
 * Creates a new transaction in the database with the new data
 * @param balanceTransaction Incoming balance transaction object
 * @returns
 */
export const recordTransaction = async (balanceTransaction: BalanceTransaction) => {
  const repository = new BalanceRepository(client);
  return await repository.createTransaction(balanceTransaction);
};

/**
 * Creates a new statement
 * @param policyId The entity Id
 */
export const createNewStatement = async (policyId: string) => {
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);

  // First we need all open invoices that are pending payment
  const foundInvoices = await billingRepo.getInvoicesByStatus(policyId, Invoice.PaymentStatus.Pending);

  if (foundInvoices) {
    // The new due date is going to be 15 days before the equity runs out
    const newDueDate = subDays(parseISO(billing.cancelDate), 15);

    const newInvoice = new Invoice({
      dueDate: newDueDate,
      pk: policyId,
      productName: billing.productKey,
      invoiceType: Invoice.InvoiceType.BillMyLender
    });
    await newInvoice.generateInvoiceNumber(Tenant.tenantEntityId);

    for (const invoice of foundInvoices) {
      for (const lineItem of invoice.invoiceLineItems) {
        // If the amount paid is the same as the amountDue then there is no need to add that lineItem to this invoice
        if (lineItem.amountPaid !== lineItem.amount) {
          newInvoice.addLineItem(
            new InvoiceLineItem({
              amount: evenRound(lineItem.amount - lineItem.amountPaid, 2),
              account: lineItem.account,
              itemType: lineItem.itemType,
              writingCompany: lineItem.writingCompany
            })
          );
        }
      }
    }
    // TODO: Print the new statement using this invoice which is not saved
  }
};

/**
 * Applies a payment to the current open invoices
 * @param policyId The policy id
 * @param amount Incoming payment amount.
 * @param payment The payment to apply
 * @returns The amount of remaining unapplied payment
 */
export const applyPaymentToOpenInvoices = async (
  billing: Billing,
  amount: number,
  payment: Payment
): Promise<number> => {
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');
  const billingRepo = new BillingRepository(client);

  // pass repository?
  const invoices = await getOpenInvoices(billing.pk, true);
  let index = 0;

  while (amount > 0 && index < invoices.length) {
    const invoice = invoices[index];
    logTrace(loggerInfo, '🚀', 'utils-applyPaymentToOpenInvoices-invoice', invoice);

    const lineItems = payment.addInvoice(invoice.invoiceNumber);
    amount = invoice.applyToInvoiceLineItems(amount, lineItems);
    await handleInstallmentInvoiceUpdate(invoice, billing, formatISO(new Date()));

    // Now we update the invoice with what was paid
    markInvoicePaid(invoice, payment.processedDateTime);
    await billingRepo.saveInvoice(invoice);
    payment.subtotal = payment.getSubtotal;
    index++;
  }

  return amount;
};

export const markInstallmentPaid = (billing: Billing, installmentNumber: number, transactionDateTime: string) => {
  const installment = billing.paymentDetail.listOfInstallments.find((x) => x.installmentNumber == installmentNumber);

  if (installment) {
    billing.paymentDetail.installmentsLeft--;
    installment.paid = true;
    installment.processedDateTime = transactionDateTime;
  }
};

export const getTime = (date?: Date) => {
  return date != null ? date.getTime() : 0;
};

/**
 * Gets the list of open and due invoices
 * @param policyId
 */
export const getOpenAndDueInvoices = async (policyId: string) => {
  const billingRepo = new BillingRepository(client);

  const openInvoices = await billingRepo.getInvoicesByStatus(policyId, Invoice.PaymentStatus.Pending);
  const openAndDueInvoices = openInvoices.filter((inv) => {
    // If the invoice duedate is after today means that we shouldnt mark it yet
    // We want to return the invoices who's due dates are not after the billing due date
    return isDue(inv.dueDate) === true;
  });
  const sortedInvoices = sortInvoices(openAndDueInvoices);
  return sortedInvoices;
};

/**
 * Gets the list of open invoices
 * @param policyId
 */
export const getOpenInvoices = async (policyId: string, sortByDueDate: boolean = false) => {
  const billingRepo = new BillingRepository(client);

  const openInvoices = await billingRepo.getInvoicesByStatus(policyId, Invoice.PaymentStatus.Pending);

  if (sortByDueDate) {
    // ISO date strings are sortable, so just sort without converting to Date objects.
    openInvoices.sort((a, b) => {
      if (a.dueDate > b.dueDate) {
        return 1;
      } else if (a.dueDate < b.dueDate) {
        return -1;
      }

      return 0;
    });
  }

  return openInvoices;
};

/**
 * Gets the total balance due of this policy
 * @param policyId The policy Id.
 * @param termEffectiveDate The term effective date.
 */
export const getTotalBalanceDue = async (policyId: string, termEffectiveDate: string) => {
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');

  const balanceRepo = new BalanceRepository(client);
  const transactions = await balanceRepo.getTransactions(policyId, termEffectiveDate, AccountingDocType.Charge);
  const totalBalance = new LineItems();

  logTrace(loggerInfo, '🚀', 'Utils-getTotalBalanceDue-transactions', transactions);
  for (const trans of transactions) {
    totalBalance.addLineItems(trans.balanceDue.lineItems);
  }

  logTrace(loggerInfo, '🚀', 'Utils-getTotalBalanceDue-totalBalance', totalBalance);
  return totalBalance;
};

/**
 * Generates a statement object.
 * @param policyId          The policy id.
 * @param billing           The billing object.
 * @param key               The incoming event key.
 * @param isRegeneration    Indicates if comes from the Regeneration document flow or not.
 */
export const generateStatementEvent = async (
  policyId: string,
  billing: Billing,
  key?: IDocumentCreateKeyInfo,
  isRegeneration?: boolean,
  listOfInvoices?: Array<Invoice>
): Promise<void> => {
  let unpaidInvoices: Array<Invoice>;
  if (listOfInvoices && listOfInvoices.length !== 0) {
    unpaidInvoices = listOfInvoices;
  } else {
    // TODO: Start using list of invoices in memory instead of fetching it every time
    unpaidInvoices = await getOpenInvoices(policyId, true);
  }
  // isStatementSent also prevents resending event
  if (unpaidInvoices.length > 0 && billing && (!billing.isStatementSent || isRegeneration)) {
    const statement = new Statement();
    statement.policyId = policyId;
    statement.dueDate = unpaidInvoices[0].dueDate;
    statement.installmentNumber = unpaidInvoices[0].installmentNumber;
    statement.installmentRemaining = billing.paymentDetail.installmentsLeft;
    statement.paymentPlan = billing.paymentPlan.planType;
    statement.responsibleParty = billing.paymentPlan.responsibleParty;
    statement.scanline = scanline(unpaidInvoices[unpaidInvoices.length - 1]);
    statement.invoiceNumber = unpaidInvoices[unpaidInvoices.length - 1].invoiceNumber;
    statement.amountDue = unpaidInvoices.map((i) => i.getUnpaidAmount()).reduce((curr, prev) => curr + prev, 0);
    statement.amountReceived = (await getAmountReceived(policyId, billing.effectiveDate)).subtotal;
    statement.amountRemaining = (await getAmountDueLeft(policyId, billing.effectiveDate)).subtotal;

    if (billing.paymentPlan.responsibleParty === PaymentPlan.ResponsibleParty.Mortgagee) {
      statement.companyName = billing.mortgagee.name;
      statement.loanNumber = billing.mortgagee.loanNumber;
    }

    if (unpaidInvoices.length > 1) {
      statement.nextBillDate = unpaidInvoices[1].dueDate;
    } else if (billing?.paymentDetail?.listOfInstallments.length > 0) {
      const nextInstallment = billing?.paymentDetail?.listOfInstallments.find((elem) => {
        return elem.installmentNumber === statement.installmentNumber + 1;
      });
      if (nextInstallment) {
        statement.nextBillDate = nextInstallment.dueDate;
      }
    }

    const detail = ServiceEventProducer.createStatementEventDetail(statement, billing.ownerEntityId, key);
    await ServiceEventProducer.sendServiceEvent(detail, ServiceEventProducer.DetailType.StatementCreate);

    billing.isStatementSent = true;
  }
};

/**
 * Parses dynamodb value to elasticsearch
 * @param value The value.
 */
export const parseESValue = (value: any): string => {
  if (value) {
    value = value.toString();
    if (value !== 'undefined' && value !== 'null') {
      return value;
    }
  }
  return '';
};

/**
 * Parses dynamodb date value to elasticsearch
 * @param value The value.
 */
export const parseESDateValue = (value: any): string => {
  let parsedValue = '';
  try {
    parsedValue = formatISO(parseISO(value), { representation: 'date' });
  } finally {
    return parsedValue;
  }
};

/**
 * Attempts to parse a string or boolean value.
 * // TODO - maybe add to api lib at some point
 * @param value Boolean or string value
 * @returns
 */
export const parseBool = (value: any): boolean => {
  let response = false;

  if (typeof value == 'boolean' || value instanceof Boolean) {
    response = value as boolean;
  } else if (typeof value == 'string' || value instanceof String) {
    value = value.trim().toLowerCase();

    if (value === 'true' || value === 'false') {
      response = value === 'true';
    }
  } else {
    throw new ArgumentError(ErrorCodes.InvalidData, 'Parsing error. Given value has no boolean meaning.');
  }

  return response;
};

/**
 * Send PaymentFailure event.
 * @param policyId The policy id.
 * @param userId The email user id.
 * @param tenantId The entity id.
 * @returns
 */
export const sendPaymentFailureEvent = async (policyId: string, userId?: string, tenantId?) => {
  const repository = new BillingRepository(client);
  const billing = await repository.get(policyId);
  if (billing) {
    userId = userId ?? billing.userInformation.email;
    tenantId = tenantId ?? billing.userInformation.entityId;
    const detail = await ServiceEventProducer.createPaymentFailureNotificationEventDetail(
      billing.userInformation.policyId,
      userId,
      billing.userInformation.entityId
    );
    await ServiceEventProducer.sendServiceEvent(detail, ServiceEventProducer.DetailType.PaymentFailureNotification);
  }
};

/* Sends a payment received event
 * @param policyId The policy id
 * @param version The version of the policy
 * @param payment The payment received
 * @param ownerEntityId The entityId of the owner of the policy
 * @param paymentReference The reference to the payment made (typeDate of the payment)
 * @param balanceDue The optional balanceDue in case it is needed in the event
 */
export const sendPaymentReceivedEvent = async (
  policyId: string,
  version: string,
  payment: Payment,
  ownerEntityId: string,
  paymentReference?: string,
  mainBalanceDue?: BalanceDue,
  companionBalanceDue?: BalanceDue
) => {
  // Send events that payment was received
  const detail = ServiceEventProducer.createPaymentEventDetail(
    policyId,
    version,
    payment,
    ownerEntityId,
    paymentReference,
    mainBalanceDue,
    companionBalanceDue
  );
  await ServiceEventProducer.sendServiceEvent(detail, ServiceEventProducer.DetailType.PaymentReceived);
};

/**
 * Sorts an array of invoices placing negative invoices first and then in dueDate.
 * @param invoices Array of invoices
 */
export const sortInvoices = (invoices: Array<Invoice>) => {
  return invoices.sort((a, b) => {
    const amountDueDiff = a.amountDue - b.amountDue;
    if (amountDueDiff === 0) {
      return getTime(new Date(a.dueDate)) - getTime(new Date(b.dueDate));
    }
    return amountDueDiff;
  });
};

/**
 * Gets the amount due left on a policy
 * @param policyId The policyId
 * @param termEffectiveDate The policy term effective date
 */
export const getAmountDueLeft = async (policyId: string, termEffectiveDate: string) => {
  const repository = new BalanceRepository(client);
  const balanceRecords = await repository.getTransactions(policyId, termEffectiveDate);
  const balanceDueLeft = new BalanceDue();

  for (const records of balanceRecords) {
    if (records.balanceDue) {
      balanceDueLeft.addLineItems(records.balanceDue.lineItems);
    } else if (records.payment) {
      for (const details of records.payment.details) {
        balanceDueLeft.addLineItems(details.lineItems);
      }
    }
  }

  return balanceDueLeft;
};

/**
 * Gets the amount received on a policy
 * @param policyId The policyId
 * @param termEffectiveDate The policy term effective date
 */
export const getAmountReceived = async (policyId: string, termEffectiveDate: string) => {
  const repository = new BalanceRepository(client);
  const paymentRecords = await repository.getTransactions(policyId, termEffectiveDate, AccountingDocType.Payment);
  const totalAmountReceived = new LineItems();

  for (const record of paymentRecords) {
    for (const details of record.payment.details) {
      totalAmountReceived.addLineItems(details.lineItems);
    }
  }

  return totalAmountReceived;
};
