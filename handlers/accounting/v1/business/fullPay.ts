import { logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { client } from '../../../../libs/dynamodb';
import { providers } from '../../../../libs/enumLib';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import {
  applyPaymentToOpenInvoices,
  getTotalBalanceDue,
  recordPayment,
  sendPaymentReceivedEvent
} from '../../../../libs/Utils';
import { evenRound } from '../../../bill2pay/bill2Pay';
import { BillingRepository } from '../BillingRepository';
import { BalanceDue } from '../models/BalanceDue';
import { Billing } from '../models/Billing';
import { BillingStatus } from '../models/BillingStatus';
import { Invoice } from '../models/Invoice';
import { LineItems } from '../models/LineItems';
import { Payment } from '../models/Payment';
import { PaymentInformation } from '../models/PaymentInformation';
import { PaymentPlan } from '../models/PaymentPlan';
import { resetDelinquencyStatus, updateBillingDates } from './billing';
import { handleMidtermChangeMortgageePayment } from './billMyLender';
import { handleMidtermChangeInsuredPayment } from './payments';

/**
 * Handle Midterm Change full payment plan
 * @param policyId The policyId.
 * @param billing The billing record.
 * @param mainBalanceDue The Main Balance Due.
 * @param companionBalanceDue The Companion Balance Due.
 */
export const handleMidtermChangeFullPayment = async (
  policyId: string,
  billing: Billing,
  mainBalanceDue: BalanceDue,
  companionBalanceDue: BalanceDue = null
) => {
  switch (billing.paymentPlan.responsibleParty) {
    case PaymentPlan.ResponsibleParty.Mortgagee:
      await handleMidtermChangeMortgageePayment(policyId, mainBalanceDue, companionBalanceDue, billing);
      break;

    case PaymentPlan.ResponsibleParty.Insured:
      await handleMidtermChangeInsuredPayment(policyId, mainBalanceDue, companionBalanceDue, billing);
      break;

    default:
      break;
  }
};

/**
 * Handle an Eleven Pay Payment
 * @param policyId The policy Id
 * @param paymentInformation Information about the payment made
 */
export const handleFullPayPayment = async (policyId: string, paymentInformation: PaymentInformation) => {
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);
  const payment = new Payment();
  let totalAmount = paymentInformation.amountPaid;
  let refundAmount = 0;
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');

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

  const remainingAmount = await applyPaymentToOpenInvoices(billing, paymentInformation.amountPaid, payment);

  // We add the amount paid to the totalAmountPaid
  billing.paymentDetail.totalAmountPaid = evenRound(
    billing.paymentDetail.totalAmountPaid + paymentInformation.amountPaid,
    2
  );

  // We full paid the policy so this is 0
  payment.remainingBalance = 0;

  billing.dueDate = billing.expirationDate;
  // If the total amount paid is greated (becauseof installment fees) or equal to the amount Due we set the flag PaymentCompleted to true automatic payments are processed
  billing.billingStatus.paymentStatus =
    billing.paymentDetail.totalAmountPaid >= billing.paymentDetail.amountDue
      ? BillingStatus.PaymentStatus.PaymentCompleted
      : BillingStatus.PaymentStatus.PaymentInProcess;
  billing.paymentDetail.invoiceStatus = Invoice.InvoicingStatusType.None;

  billing.paymentDetail.paymentCompleted =
    billing.billingStatus.paymentStatus === BillingStatus.PaymentStatus.PaymentCompleted ? true : false;

  // To force resending statement
  billing.isStatementSent = billing.paymentDetail.totalAmountPaid === billing.paymentDetail.amountDue;

  // Delinquency process check
  const delinquencyStatus = billing.billingStatus.delinquencyStatus;

  logTrace(loggerInfo, '🚀', 'fullpay-handleFullPayPayment-payment', payment);

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

  // Last we update the billing equity
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
 * @param termEffectiveDate The term effective date.
 */
export const getFullPayAmount = async (policyId: string, termEffectiveDate: string) => {
  let amount = 0;

  // TODO: We expect no payments to have been made when creating the first transaction token but if this is used for renewal total paid must be subtracted from these line items
  const totalBalanceDue = await getTotalBalanceDue(policyId, termEffectiveDate);

  for (const lineItems of totalBalanceDue.lineItems) {
    amount = evenRound(amount + lineItems.amount, 2);
  }

  return amount;
};
