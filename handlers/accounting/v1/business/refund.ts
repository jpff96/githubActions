import { formatISO } from 'date-fns';
import { BillingRepository } from '../BillingRepository';
import { BalanceDue } from '../models/BalanceDue';
import { LineItem } from '../models/LineItem';
import { PremiumRefund } from '../models/PremiumRefund';
import { Payment } from '../models/Payment';
import { DisbursementRepository } from '../../../disbursement/v1/DisbursementRepository';
import { DisbursementPayload, Recipient } from '../../../disbursement/v1/models';
import { client } from '../../../../libs/dynamodb';
import { CostType, DeliveryMethodType, PaymentTypes, providers, Reasons } from '../../../../libs/enumLib';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';

const { DisbursementRecordType } = DisbursementRepository;

/**
 * Map the data from a balance refund into the payload to create a disbursement
 * @param refundBalanceDue  Refund balance due
 * @param policyId          Policy ID
 * @param recipient         The person who will receive the payment
 */
export const mapBalanceDueToDisbursementPayload = (
  refundBalanceDue: BalanceDue,
  policyId: string,
  productKey: string,
  recipient: Recipient
): DisbursementPayload => {
  const { description, policyNumber, subtotal } = refundBalanceDue;
  const { address, companyName, email, firstName, lastName } = recipient;

  return new DisbursementPayload({
    amount: subtotal,
    costType: CostType.PremiumRefund,
    deliveryMethod: DeliveryMethodType.Standard,
    description,
    disbursementType: DisbursementRecordType.Disbursement,
    mailingAddress: address,
    policyId,
    policyNumber,
    productKey,
    recipients: [recipient],
    referenceId: policyId,
    referenceNumber: policyNumber,
    shippingCompanyName: companyName,
    shippingEmail: email,
    shippingFirstName: firstName,
    shippingLastName: lastName,
    reason: Reasons.Cancellation
  });
};

/**
 * Triggers Premium refund when the policy is paid
 * @param refundLineItem Line item to be refunded.
 * @param policyId The policyId.
 * @param policyNumber The policy Number.
 * @returns.
 */
export const createPremiumRefundFromLineItems = async (
  refundLineItems: Array<LineItem>,
  policyId: string,
  policyNumber: string,
  invoiceNumber: string
) => {
  const premiumRefund = new PremiumRefund();
  premiumRefund.policyNumber = policyNumber;
  premiumRefund.description = 'Refund';
  premiumRefund.addLineItems(refundLineItems);

  const detail = ServiceEventProducer.createRefundEventDetail(premiumRefund, invoiceNumber, policyId);
  //This event send the payment info to policyAPI to be able to request all insured data from PolicyAPI
  await ServiceEventProducer.sendServiceEvent(detail, ServiceEventProducer.DetailType.InitiatedRefund);
};

/**
 * Creates Payment fromrefund.
 * @param refundAmount Amount to be refunded.
 * @param policyId The policyId.
 * @param invoiceNumber The invoice number tied to the refund invoice
 * @returns.
 */
export const mapLineItemsToRefundPayment = async (
  policyId: string,
  lineItems: Array<LineItem>,
  invoiceNumber: string
) => {
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);

  const payment = new Payment();

  // We add information regarding the payment
  payment.paymentType = PaymentTypes.CHECK;
  payment.customerId = billing.userInformation?.customerId;
  payment.accountLast4 = '';
  payment.provider = providers.VPay;
  payment.cognitoUserId = billing.userInformation?.email;
  payment.processedDateTime = formatISO(new Date());
  payment.confirmationNumber = '';
  payment.providerReference = payment.confirmationNumber;
  payment.companionNumber = billing.companionNumber;
  payment.productKey = billing.productKey;
  payment.policyNumber = billing.policyNumber;
  payment.providerFee = 0;
  payment.description = 'Premium Refund';
  payment.status = Payment.PaymentStatus.Pending;

  for (let lineItem of lineItems) {
    payment.addLineItem(invoiceNumber, lineItem);
  }
  payment.subtotalPlusProviderFee = payment.subtotal;

  payment.remainingBalance = 0;

  return payment;
};
