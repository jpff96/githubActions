import { Disbursement } from '../models';
import { updatePaymentStatus } from '../../../accounting/v1/business/payments';
import { Payment } from '../../../accounting/v1/models/Payment';
import { PaymentStatus } from '../../../accounting/v1/models/PaymentStatus';

/**
 * Voids the payment of the disbursement. This method does not balance the payment section
 * @param disbursement  Disbursement to reject
 */
export const voidDisbursementPayment = async (disbursement: Disbursement): Promise<void> => {
  const { policyId } = disbursement;

  const typeDate = disbursement.referenceId;

  const paymentStatus = new PaymentStatus();
  paymentStatus.state = Payment.PaymentStatus.Voided;
  paymentStatus.updatedDateTime = new Date().toISOString();
  await updatePaymentStatus(policyId, typeDate, paymentStatus);
};
