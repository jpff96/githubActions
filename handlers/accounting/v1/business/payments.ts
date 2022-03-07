import { logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import * as math from 'mathjs';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { client } from '../../../../libs/dynamodb';
import { BalanceRecordType, providers } from '../../../../libs/enumLib';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import {
  applyPaymentToOpenInvoices,
  generateStatementEvent,
  getAmountDueLeft,
  getPaymentInformation,
  getPaymentType,
  recordPayment,
  saveLastPaymentMethodUsed,
  sendPaymentReceivedEvent
} from '../../../../libs/Utils';
import { evenRound } from '../../../bill2pay/bill2Pay';
import { PaymentWithPaymentMethodRequest } from '../../../bill2pay/models/PayWithPaymentMethodTokenRequest';
import { makePaymentWithToken } from '../../../bill2pay/payWithMethodToken';
import { BalanceRepository } from '../BalanceRepository';
import { BillingRepository } from '../BillingRepository';
import { BalanceDue } from '../models/BalanceDue';
import { Billing } from '../models/Billing';
import { BillingStatus } from '../models/BillingStatus';
import { Invoice } from '../models/Invoice';
import { LineItem } from '../models/LineItem';
import { Payment } from '../models/Payment';
import { PaymentPlan } from '../models/PaymentPlan';
import { PaymentStatus } from '../models/PaymentStatus';
import { resetDelinquencyStatus, updateBillingDates } from './billing';
import { handleElevenPayPayment, handleMidtermChangeElevenPayment } from './elevenPay';
import { handleFullPayPayment, handleMidtermChangeFullPayment } from './fullPay';
import { midTermInvoiceCreation } from './invoicing';
import { getReinstatementBalanceDue } from './reinstatement';

/**
 * Updates a payment transaction record in the balance table
 * @param policyId The policy Id
 * @param typeDate The sk value of type and date.
 * @param paymentStatus The payment status to set.
 */
export const updatePaymentStatus = async (policyId: string, typeDate: string, paymentStatus: PaymentStatus) => {
  const repository = new BalanceRepository(client);
  const transaction = await repository.getTransaction(policyId, typeDate);

  if (transaction) {
    transaction.payment.status = paymentStatus.state;
    transaction.payment.processedDateTime = paymentStatus.updatedDateTime || new Date().toISOString();

    await repository.updateTransaction(transaction);
  }

  return transaction;
};

/**
 * Process the payment using an invoice
 * @param paymentInformation The information of the payment made.
 * @param policyId The policyId.
 * @param invoice The invoice that was paid for.
 */

export const processPaymentThroughInvoice = async (paymentInformation: any, policyId: string, invoice: Invoice) => {
  switch (invoice.invoiceType) {
    case Invoice.InvoiceType.MidTermChange:
      await midTermInvoicePayment(paymentInformation, policyId, invoice);
      break;

    // Add other cases to handle invoice payments correctly
    default:
      break;
  }
};

/**
 * Create a Mid Term Invoice Payment
 * @param paymentInformation TThe information of the payment made.
 * @param policyId The policyId.
 * @param invoice The invoice of the payment.
 */

export const midTermInvoicePayment = async (paymentInformation: any, policyId: any, invoice: Invoice) => {
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);

  try {
    const payment = new Payment();

    payment.subtotalPlusProviderFee = paymentInformation.amount + paymentInformation.fee;
    payment.paymentType = getPaymentType(paymentInformation.paymentType);
    payment.customerId = billing.userInformation?.customerId || paymentInformation.customerId;
    payment.accountLast4 = paymentInformation.paymentMethod;
    payment.provider = providers.Bill2Pay;
    payment.cognitoUserId = billing.userInformation?.email;
    payment.processedDateTime = paymentInformation.transactionDateTime;
    payment.confirmationNumber = paymentInformation.confirmationNumber;
    payment.providerReference = paymentInformation.confirmationNumber;
    payment.companionNumber = billing.companionNumber;
    payment.productKey = billing.productKey;
    payment.policyNumber = billing.policyNumber;
    payment.authCode = paymentInformation.authCode;
    payment.providerFee = paymentInformation.fee;
    payment.description = 'Premium Received';

    // We add the amount paid to the totalAmountPaid
    billing.paymentDetail.totalAmountPaid = evenRound(
      billing.paymentDetail.totalAmountPaid + paymentInformation.amount,
      2
    );

    const remainingAmount = await applyPaymentToOpenInvoices(billing, paymentInformation.amount, payment);

    billing.billingStatus.paymentStatus =
      billing.paymentDetail.totalAmountPaid >= billing.paymentDetail.amountDue
        ? BillingStatus.PaymentStatus.PaymentCompleted
        : BillingStatus.PaymentStatus.PaymentInProcess;

    // Now we record the payment in the balance table
    const transaction = await recordPayment(
      payment,
      billing.userInformation.policyId,
      billing.ownerEntityId,
      billing.userInformation.version,
      billing.effectiveDate
    );
    const amountDueLeft = (await getAmountDueLeft(policyId, billing.effectiveDate))?.subtotal;
    payment.remainingBalance = math.round(amountDueLeft, 2);
    await sendPaymentReceivedEvent(
      policyId,
      billing.userInformation.version,
      payment,
      billing.ownerEntityId,
      transaction.typeDate
    );
  } catch (error) {
    console.error(error);
    // Handle error correctly
  }
};

/**
 * Handle Midterm Change full payment
 * @param policyId The policyId.
 * @param mainBalanceDue The Main Balance Due.
 * @param companionBalanceDue The Companion Balance Due.
 */
export const handleMidtermChangeInsuredPayment = async (
  policyId: string,
  mainBalanceDue: BalanceDue,
  companionBalanceDue: BalanceDue = null,
  billing: Billing
) => {
  // We create the invoice for these new changes
  if (companionBalanceDue && companionBalanceDue.subtotal !== 0) {
    mainBalanceDue.addLineItems(companionBalanceDue.lineItems);
  }
  const midTermChangeInvoice = await midTermInvoiceCreation(policyId, mainBalanceDue);

  const initializePayWithTokenRequest = new PaymentWithPaymentMethodRequest({
    allowCreditCard: true,
    allowECheck: true,
    amount: midTermChangeInvoice.amountDue,
    policyId: billing.pk,
    policyNumber: billing.policyNumber,
    provider: providers.Bill2Pay,
    redirectHref: '',
    productName: billing.productKey,
    accountNumber: billing.accountNumber,
    paymentPlan: PaymentPlan.PaymentPlanType.FullPay,
    paymentMethodToken: billing.paymentMethod.defaultPaymentMethod.token,
    customerId: billing.userInformation.customerId,
    paymentSource: 'Portal',
    isFirstPayment: false
  });

  // We process the payment
  // If the payment fails an email is sent to the insured
  await makePaymentWithToken(billing.userInformation.entityId, initializePayWithTokenRequest, midTermChangeInvoice);
};

/**
 * Handle a payment received
 * @param policyId The policyId.
 */
export const handleNewBusinessPayment = async (policyId: string, paymentPlan: PaymentPlan.PaymentPlanType) => {
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');

  // The first thing we should do is to save the last payment method used as the default payment method
  await saveLastPaymentMethodUsed(policyId);
  // Now we get the payment information using the transaction token
  const paymentInformation = await getPaymentInformation(policyId);

  logTrace(loggerInfo, '🚀', 'payments-handleNewBusinessPayment-paymentInformation', paymentInformation);

  // After getting the payment information we have all we need to process the payment
  switch (paymentPlan) {
    case PaymentPlan.PaymentPlanType.ElevenPay:
      // We handle a payment that was made using Eleven Pay
      await handleElevenPayPayment(policyId, paymentInformation, true);
      break;

    case PaymentPlan.PaymentPlanType.FullPay:
      // We handle a payment that was made using Full Pay
      await handleFullPayPayment(policyId, paymentInformation);
      break;

    default:
      break;
  }
};

/**
 * Handle Midterm Change payment
 * @param policyId The policyId.
 * @param mainBalanceDue The Main Balance Due.
 * @param companionBalanceDue The Companion Balance Due.
 */
export const handleMidtermChangePayment = async (
  billing: Billing,
  policyId: string,
  mainBalanceDue: BalanceDue,
  companionBalanceDue: BalanceDue = null
) => {
  switch (billing.paymentPlan.planType) {
    case PaymentPlan.PaymentPlanType.FullPay:
      await handleMidtermChangeFullPayment(policyId, billing, mainBalanceDue, companionBalanceDue);
      break;

    case PaymentPlan.PaymentPlanType.ElevenPay:
      await handleMidtermChangeElevenPayment(policyId, mainBalanceDue, companionBalanceDue, billing);
      break;

    default:
      break;
  }
};

/**
 * Updates the line items of the payment record
 * @param policyId The policyId
 * @param typeDate The key to fetch the payment
 * @param lineItems The line items to update the payment
 */
export const updatePaymentLineItems = async (policyId: string, typeDate: string, payment: Payment) => {
  const balanceRepository = new BalanceRepository(client);

  const transaction = await balanceRepository.getTransaction(policyId, typeDate);

  if (transaction) {
    const originalPaymentAmount = transaction.payment.subtotal;
    const newPayment = new Payment(transaction.payment);
    // We clear the payment's line items
    newPayment.clearLineItems();
    for (const detail of payment.details) {
      newPayment.addLineItems(detail.invoiceNumber, detail.lineItems);
    }

    // before saving the payment record updated we need to check that the new subtotal of the payment didn't change, otherwise the line items didnt match and the policy is out of balance
    if (newPayment.subtotal !== originalPaymentAmount) {
      // TODO: Put the policy in an out of balance state
    }
    transaction.payment = newPayment;
    await balanceRepository.updateTransaction(transaction);
  }
};

/**
 * Handles a generic payment that was received
 * @param policyId The policyId of the policy that received payment
 * @param amount The amount that was paid
 * @param payment The payment object without lineitems
 */
export const handlePaymentWithReinstate = async (policyId: string, amount: number, payment: Payment) => {
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');
  const balanceRepo = new BalanceRepository(client);
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);
  payment.customerId = billing.userInformation?.customerId;

  logTrace(loggerInfo, '🚀', 'payments-handlePaymentReceived-payment', payment);
  const remainingAmount = await applyPaymentToOpenInvoices(billing, amount, payment);

  // TODO - Need to apply remaining amount to future installments or refund it. Maybe this is a
  // trigger for out of balance queue?
  if (remainingAmount > 0) {
    logTrace(
      loggerInfo,
      '🚀',
      `payments-handlePaymentReceived remaining amount of ${remainingAmount} left after payment applied to invoices`
    );
    const lineItem = new LineItem({
      amount: remainingAmount,
      itemType: LineItem.ItemType.Premium,
      account: LineItem.AccountType.Main,
      writingCompany: 'FPIC'
    });
    payment.subtractLineItem(null, lineItem);

    if (billing.dueDate) {
      // Since there was an overpayment and the policy hasnt been cancelled (so we dont do this when a reinstatement is due)
      const detail = await ServiceEventProducer.createOutOfBalanceDetail(policyId);
      await ServiceEventProducer.sendServiceEvent(detail, ServiceEventProducer.DetailType.PolicyOutOfBalance);

      // Send activity logs
      await ActivityLogProducer.sendActivityLog(
        policyId,
        billing.agencyEntityId,
        'Policy {{policyId}} has an overpayment of ${{remainingAmount}} and is out of balance.',
        {
          policyId,
          remainingAmount
        }
      );
    }
  }

  // TODO: When using this method as a generic payment entry we need to add different flows for the different paymentPlans
  // TODO: Move this block to a reinstatement specific flow
  let mainBalanceDue;
  let companionBalanceDue;
  let remainingBalance = 0;
  let amountDueLeft = 0;

  // If policy is canceled, we need to get the remaining balance from the existing cancellation records
  // and then adding the payment received and the credit left.
  if (!billing.dueDate) {
    let cancelDate = billing.cancellationDate;
    if (billing.paymentPlan.responsibleParty === PaymentPlan.ResponsibleParty.Mortgagee) {
      cancelDate = billing.effectiveDate;
      payment.responsibleParty = billing.paymentPlan.responsibleParty;
    }
    mainBalanceDue = await getReinstatementBalanceDue(policyId, cancelDate, BalanceRecordType.MainBalanceDue);
    companionBalanceDue = await getReinstatementBalanceDue(policyId, cancelDate, BalanceRecordType.CompanionBalanceDue);
    remainingBalance = evenRound(mainBalanceDue?.subtotal + remainingBalance, 2);
    if (companionBalanceDue) {
      remainingBalance = evenRound(companionBalanceDue.subtotal + remainingBalance, 2);
    }
    remainingBalance = evenRound(payment.subtotal + remainingBalance, 2);

    // If any credit left remains after the cancellation, we have to include it to the remaining balance amount.
    const totals = await balanceRepo.getTotals(policyId, billing.effectiveDate);
    if (totals) {
      const totalPayments = totals.totalPayments ?? 0;
      const creditLeft = evenRound(totals.totalBalanceDue + totalPayments, 2);
      remainingBalance = evenRound(remainingBalance + creditLeft, 2);
    }
  } else {
    amountDueLeft = (await getAmountDueLeft(policyId, billing.effectiveDate))?.subtotal;
    remainingBalance = evenRound(amountDueLeft + remainingBalance + payment.subtotal, 2);
  }

  payment.remainingBalance = remainingBalance;
  const transaction = await recordPayment(
    payment,
    policyId,
    billing.ownerEntityId,
    billing.userInformation.version,
    billing.effectiveDate
  );

  await resetDelinquencyStatus(billing, payment.processedDateTime);

  // Generate statement event
  if (remainingBalance > 0) {
    billing.isStatementSent = false;
    await generateStatementEvent(policyId, billing);
  }

  await updateBillingDates(billing);

  await billingRepo.save(billing);

  await sendPaymentReceivedEvent(
    policyId,
    billing.userInformation.version,
    payment,
    billing.ownerEntityId,
    transaction.typeDate,
    new BalanceDue(mainBalanceDue),
    new BalanceDue(companionBalanceDue)
  );

  await ActivityLogProducer.sendActivityLog(
    policyId,
    billing.agencyEntityId,
    'Payment in the amount of {{amount}} processed on {{transactionDateTime}}',
    {
      amount: math.abs(payment.subtotal),
      transactionDateTime: payment.processedDateTime
    }
  );
};
