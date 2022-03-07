import { logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import * as math from 'mathjs';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { client } from '../../../../libs/dynamodb';
import { providers } from '../../../../libs/enumLib';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import {
  applyPaymentToOpenInvoices,
  getAmountDueLeft,
  getTotalBalanceDue,
  recordBalanceDue,
  recordPayment,
  sendPaymentReceivedEvent
} from '../../../../libs/Utils';
import { evenRound } from '../../../bill2pay/bill2Pay';
import { BillingRepository } from '../BillingRepository';
import { BalanceDue } from '../models/BalanceDue';
import { Billing } from '../models/Billing';
import { BillingStatus } from '../models/BillingStatus';
import { LineItem } from '../models/LineItem';
import { Payment } from '../models/Payment';
import { PaymentInformation } from '../models/PaymentInformation';
import { resetDelinquencyStatus, updateBillingDates, updateBillingEquity, updateDueDate } from './billing';
import { generateInstallmentFeeBalanceDue, generateInstallmentFeeInvoice } from './installment';
import { handleMidtermChangeInsuredPayment } from './payments';

/**
 * Handle Midterm Change eleven pay payment plan
 * @param policyId The policyId.
 * @param mainBalanceDue The Main Balance Due.
 * @param companionBalanceDue The Companion Balance Due.
 */
export const handleMidtermChangeElevenPayment = async (
  policyId: string,
  mainBalanceDue: BalanceDue,
  companionBalanceDue: BalanceDue = null,
  billing: Billing
) => {
  // TODO: For now we capture the full amount of the change, in the future the user can select between full payment or adding to the eleven pay installments
  await handleMidtermChangeInsuredPayment(policyId, mainBalanceDue, companionBalanceDue, billing);
};

/**
 * Handle an Eleven Pay Payment
 * @param policyId The policy Id
 * @param paymentInformation Information about the payment made
 * @param isFirstPayment Flag to check if this is the first payment
 */
export const handleElevenPayPayment = async (
  policyId: string,
  paymentInformation: PaymentInformation,
  isFirstPayment: boolean = false
) => {
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);
  const payment = new Payment();

  // We add information regarding the payment
  payment.subtotalPlusProviderFee = paymentInformation.amountPaid + paymentInformation.providerFee;
  payment.paymentType = paymentInformation.paymentType;
  payment.customerId = billing.userInformation?.customerId;
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
  payment.providerFee = paymentInformation.providerFee;
  payment.description = 'Premium Received';

  // If the total amount paid is greated (becauseof installment fees) or equal to the amount Due we set the flag PaymentCompleted to true automatic payments are processed
  billing.billingStatus.paymentStatus =
    billing.paymentDetail.totalAmountPaid >= billing.paymentDetail.amountDue
      ? BillingStatus.PaymentStatus.PaymentCompleted
      : BillingStatus.PaymentStatus.PaymentInProcess;

  billing.billingStatus.invoiceStatus = BillingStatus.InvoiceStatus.Pending;

  let installmentFee = 0;
  if (isFirstPayment === false) {
    await generateInstallmentFeeInvoice(billing);
    const installmentFeeBalanceDue = await generateInstallmentFeeBalanceDue(billing);
    await recordBalanceDue(installmentFeeBalanceDue, billing.pk, billing.ownerEntityId, billing.effectiveDate);
    installmentFee = installmentFeeBalanceDue.subtotal;
  }

  logTrace(loggerInfo, '🚀', 'payments-handlePaymentReceived-payment', payment);
  const remainingAmount = await applyPaymentToOpenInvoices(billing, paymentInformation.amountPaid, payment);

  const amountDueLeft = (await getAmountDueLeft(policyId, billing.effectiveDate))?.subtotal;
  // We want to exclude the installmentFee from the remaining balance.
  payment.remainingBalance = math.round(amountDueLeft + payment.subtotal - installmentFee, 2);

  logTrace(loggerInfo, '🚀', 'installment-billing-handling-eleven-pay-payment', payment);
  const transaction = await recordPayment(
    payment,
    policyId,
    billing.ownerEntityId,
    billing.userInformation.version,
    billing.effectiveDate
  );

  await resetDelinquencyStatus(billing, paymentInformation.transactionDateTime);

  await sendPaymentReceivedEvent(
    policyId,
    billing.userInformation.version,
    payment,
    billing.ownerEntityId,
    transaction.typeDate
  );

  logTrace(loggerInfo, '🚀', 'installment-billing-handling-eleven-pay-payment-saving-billing', billing);
  // Last we update the billing dates
  await updateBillingDates(billing);
  await billingRepo.save(billing);

  await ActivityLogProducer.sendActivityLog(
    policyId,
    billing.agencyEntityId,
    'Payment in the amount of {{amount}} processed on {{transactionDateTime}}',
    {
      amount: paymentInformation.amountPaid,
      transactionDateTime: paymentInformation.transactionDateTime
    }
  );
};

/**
 * Creates installment payment amounts
 * @param policyId The policyId
 * @param termEffectiveDate The term effective date
 * @returns An object with both firstDownPayment and installments amounts
 */
export const getElevenPayAmount = async (policyId: string, termEffectiveDate: string) => {
  let firstDownPayment = 0;
  let installments = 0;
  // TODO: We expect no payments to have been made when creating the first transaction token but if this is used for renewal total paid must be subtracted from these line items
  const totalBalanceDue = await getTotalBalanceDue(policyId, termEffectiveDate);
  for (const lineItems of totalBalanceDue.lineItems) {
    switch (lineItems.itemType) {
      case LineItem.ItemType.Premium:
        firstDownPayment = evenRound(firstDownPayment + lineItems.amount * 0.167, 2);
        installments = evenRound(installments + lineItems.amount * 0.0833, 2);
        break;
      case LineItem.ItemType.Tax:
      case LineItem.ItemType.Fee:
        firstDownPayment = evenRound(firstDownPayment + lineItems.amount, 2);
        break;
      default:
        break;
    }
  }
  return { firstDownPayment, installments };
};
