import * as math from 'mathjs';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { recordPayment } from '../../../../libs/Utils';
import { uploadFilesToDocumentSystem } from '../../../lockbox/v1/schedule/uploadFilesToDocumentSystem';
import { BillingRepository } from '../BillingRepository';
import { updateBillingDates } from '../business/billing';
import { revertInvoicePayment } from '../business/invoicing';
import { handlePaymentWithReinstate } from '../business/payments';
import { ActionRequest } from '../models/ActionRequest';
import { Billing } from '../models/Billing';
import { Payment } from '../models/Payment';

/**
 * Method that handles the transfer of a payment between 2 policies
 * @param requestAction Request Action object containing information about the action
 * @param policyId The policy Id of the original policy
 * @param billing The billing record of the policy
 * @param repository The billing repository
 */
export const handlePaymentTransfer = async (
  requestAction: ActionRequest,
  policyId: string,
  billing: Billing,
  repository: BillingRepository
) => {
  const { entityId, version, termEffectiveDate } = requestAction;

  // Get payment from request
  const payment = new Payment(requestAction.payment);
  const paymentAmount = payment.subtotal;
  payment.negateLineItems();
  payment.description = 'Transfered to ' + requestAction.transferPolicyNumber;
  payment.action = Payment.Actions.TransferOut;

  // Get destination policy billing record
  const transferedBilling = await repository.get(requestAction.transferPolicyId);

  // move money and documents(check images, receipt(clone to new policy), ...)
  if (transferedBilling) {
    const transferPayment = new Payment(requestAction.payment);
    // We start by clearing the payment line items on the to be transfered payment
    transferPayment.clearLineItems();
    transferPayment.description = `Transfer of payment from policy: ${payment.policyNumber}`;
    transferPayment.policyNumber = requestAction.transferPolicyNumber;
    transferPayment.action = Payment.Actions.TransferIn;

    // After doing this we need to trigger the payment received handler
    await handlePaymentWithReinstate(requestAction.transferPolicyId, math.abs(paymentAmount), transferPayment);

    // We upload the images
    if (payment.images.length > 0) {
      await uploadFilesToDocumentSystem(
        entityId,
        transferedBilling.ownerEntityId,
        requestAction.transferPolicyId,
        requestAction.transferPolicyId,
        transferPayment.images
      );
    }
  } else {
    throw new Error(`Could not find the corresponding billing record of policy: ${requestAction.transferPolicyId}`);
  }

  // Set invoice(s) to unpaid that were marked as paid
  for (const lineItems of payment.details) {
    if (lineItems.invoiceNumber) {
      const invoice = await revertInvoicePayment(policyId, lineItems.invoiceNumber, lineItems.lineItems);

      // Also update the corresponding installment if the invoice is related to an installment
      if (invoice?.installmentNumber > 0) {
        const installment = billing.paymentDetail.listOfInstallments.find(
          (i) => i.installmentNumber === invoice.installmentNumber
        );

        if (installment) {
          installment.paid = false;
        }
      }
    }
  }

  // Record the balance record for the reversal of the payment
  const transaction = await recordPayment(payment, policyId, entityId, version, termEffectiveDate);

  // Update the billing dates on this policy since a payment was reversed
  await updateBillingDates(billing);

  await repository.save(billing);

  await ActivityLogProducer.sendActivityLog(
    policyId,
    billing.agencyEntityId,
    'Transferred payment in the amount of {{amount}}, reference {{paymentReference}} to policy {{transferPolicyId}}',
    {
      amount: math.abs(payment.subtotal),
      paymentReference: transaction.typeDate,
      transferPolicyId: requestAction.transferPolicyId
    }
  );
};
