import {
  setBillingFromBalanceDue,
  updateBillingDates,
  updateBillingFromPolicyCancel,
  updateBillingFromReinstatement
} from '../business/billing';
import { handleMidtermChangeInsuredPayment, updatePaymentStatus } from '../business/payments';
import {
  mapLineItemsToRefundPayment,
  mapBalanceDueToDisbursementPayload,
  createPremiumRefundFromLineItems
} from '../business/refund';
import { BalanceDue } from '../models/BalanceDue';
import { BalanceTransaction } from '../models/BalanceTransaction';
import { Payment } from '../models/Payment';
import { createDisbursements } from '../../../disbursement/v1/helpers/createDisbursements';
import { DisbursementPayload, Disbursement } from '../../../disbursement/v1/models';
import { DisbursementRepository } from '../../../disbursement/v1/DisbursementRepository';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import Tenant from '../../../../libs/Tenant';
import { getAmountDueLeft, generateStatementEvent, recordBalanceDue, recordTransaction } from '../../../../libs/Utils';
import { ErrorCodes } from '../../../../models/ErrorCodes';
import ExtendableError from '../../../../models/ExtendableError';
import { PaymentTypes } from '../../../../libs/enumLib';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import { logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { BillingRepository } from '../BillingRepository';
import { client } from '../../../../libs/dynamodb';
import { applyCreditToInvoices, markInvoicePaid, midTermInvoiceCreation } from '../business/invoicing';
import { PaymentPlan } from '../models/PaymentPlan';
import { recalculateInstallments } from '../business/installment';
import { handleMidtermChangeMortgageePayment } from '../business/billMyLender';
import { generateInvoice } from '../schedule/invoicing';
import { BillingStatus } from '../models/BillingStatus';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { requestDisbursementAction } from '../../../disbursement/v1/helpers/requestDisbursementAction';
import { PaymentStatus } from '../models/PaymentStatus';
import { MortgageeModel } from '../../../mortgageeList/v1/models';

const { Actions } = Disbursement;

/**
 * Main entry point for event response hander.
 * @param {object} event Event data.
 */
export const main = async (event) => {
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');
  logTrace(loggerInfo, '🚀', `eventHandling`, event);

  try {
    const { ['detail-type']: detailType, detail } = event;
    logTrace(loggerInfo, '🚀', `detailType: ${detailType}`);

    const {
      key: keys,
      balanceDue,
      recipient,
      companionBalanceDue,
      disbursementId,
      mortgagee: mortgageeDetail
    } = detail;
    const {
      policyId,
      agencyEntityId,
      entityId,
      termEffectiveDate,
      transEffectiveDate,
      termExpirationDate,
      productKey,
      invoiceNumber
    } = keys;

    Tenant.initFromEvent(keys);
    const billingRepo = new BillingRepository(client);
    const billing = await billingRepo.get(policyId);

    switch (detailType) {
      // Policy changed, process payment for it
      case ServiceEventProducer.DetailType.ProcessChangePayment:
        try {
          const newMainBalanceDue = new BalanceDue(balanceDue);

          if (newMainBalanceDue.subtotal === 0) {
            throw new Error("The balanceDue amount can't be 0");
          }

          await recordBalanceDue(newMainBalanceDue, policyId, entityId, termEffectiveDate);
          // We update the billing record with the new lineItems
          await setBillingFromBalanceDue(
            policyId,
            agencyEntityId,
            newMainBalanceDue,
            termEffectiveDate,
            termExpirationDate,
            productKey,
            entityId
          );

          let newCompanionBalanceDue;

          // If there is a companion Balance Due we need to process it as well
          if (companionBalanceDue && companionBalanceDue.subtotal !== 0) {
            newCompanionBalanceDue = new BalanceDue(companionBalanceDue);
            await recordBalanceDue(newCompanionBalanceDue, policyId, entityId, termEffectiveDate);
            await setBillingFromBalanceDue(
              policyId,
              agencyEntityId,
              newCompanionBalanceDue,
              termEffectiveDate,
              termExpirationDate,
              productKey,
              entityId
            );
          }

          // If the subtotal is negative it's a premium decrease
          if (newMainBalanceDue.subtotal < 0) {
            const refundBalanceDUe = new BalanceDue(newMainBalanceDue);
            if (companionBalanceDue && companionBalanceDue.subtotal !== 0) {
              refundBalanceDUe.addLineItems(companionBalanceDue.lineItems);
            }
            const invoice = await midTermInvoiceCreation(policyId, refundBalanceDUe);

            const remainingAmount = await applyCreditToInvoices(billing);
            // If there is credit left after applying it to open invoices we either spread evenly between installments or trigger a refund or both
            if (remainingAmount > 0) {
              if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay) {
                await recalculateInstallments(billing);
              }
            }

            // The only way that a refund would be due is if the amountDueLeft on the policy is negative
            const amountDueLeft = await getAmountDueLeft(policyId, billing.effectiveDate);

            if (amountDueLeft.subtotal < 0) {
              // If there is more money left to be refunded we need to trigger a refund
              amountDueLeft.negateLineItems();
              await createPremiumRefundFromLineItems(
                amountDueLeft.lineItems,
                policyId,
                billing.policyNumber,
                invoice.invoiceNumber
              );
            }
          } // Else it's a premium increase
          else {
            switch (billing.paymentPlan.responsibleParty) {
              case PaymentPlan.ResponsibleParty.Mortgagee:
                await handleMidtermChangeMortgageePayment(policyId, newMainBalanceDue, companionBalanceDue, billing);
                break;
              case PaymentPlan.ResponsibleParty.Insured:
                await handleMidtermChangeInsuredPayment(policyId, newMainBalanceDue, newCompanionBalanceDue, billing);
                break;
              default:
                break;
            }
          }

          billing.isStatementSent = false;
          await generateStatementEvent(policyId, billing);

          await updateBillingDates(billing);
          await billingRepo.save(billing);
          // We send an empty detail when the payment is sucessfull
          const detail = await ServiceEventProducer.createMidTermChangePaymentEventDetail(policyId);
          await ServiceEventProducer.sendServiceEvent(
            detail,
            ServiceEventProducer.DetailType.ProcessChangePaymentResponse
          );
        } catch (error) {
          const detail = await ServiceEventProducer.createMidTermChangePaymentEventDetail(
            policyId,
            new Error('There was an error processing the mid term change')
          );
          await ServiceEventProducer.sendServiceEvent(
            detail,
            ServiceEventProducer.DetailType.ProcessChangePaymentResponse
          );
          // TODO: Send proper activity log
        }
        break;

      case ServiceEventProducer.DetailType.PolicyCanceledRefund:
        // Policy cancel and refund
        let version = null;

        if (balanceDue) {
          const refundBalanceDue = new BalanceDue(balanceDue);
          await recordBalanceDue(refundBalanceDue, policyId, entityId, termEffectiveDate);

          version = balanceDue.version;

          // Update billing to remove any future invoicing and installment actions
          await updateBillingFromPolicyCancel(policyId, refundBalanceDue, transEffectiveDate);
        }

        if (companionBalanceDue) {
          // If there's a companion balance due we need to add those line items as well
          const refundCompanionBalanceDue = new BalanceDue(companionBalanceDue);
          await recordBalanceDue(refundCompanionBalanceDue, policyId, entityId, termEffectiveDate);

          if (!version) {
            version = companionBalanceDue.version;
          }

          await updateBillingFromPolicyCancel(policyId, refundCompanionBalanceDue, transEffectiveDate);
        }

        // Get the refund info from the event if a refund is due and create a disbursement
        const { refund } = detail;

        if (refund.subtotal !== 0) {
          const disbursementBalDue = new BalanceDue(refund);

          // Map refundBalanceDue data to create disbursement payload
          const disbursementPayload = mapBalanceDueToDisbursementPayload(
            disbursementBalDue,
            policyId,
            productKey,
            recipient
          );

          // Negate the line items so we can the opposite invoice added
          disbursementBalDue.negateLineItems();
          const invoice = await midTermInvoiceCreation(policyId, disbursementBalDue, true);
          markInvoicePaid(invoice);
          await billingRepo.saveInvoice(invoice);
          const payment = new Payment(refund);
          payment.status = Payment.PaymentStatus.Pending;
          payment.productKey = productKey;
          payment.description = 'Premium Refund Cancellation';
          payment.paymentType = PaymentTypes.CHECK;

          // We wipe the lineItems so we can add them with the respective invoiceNumber
          payment.clearLineItems();

          payment.addLineItems(invoice.invoiceNumber, refund.lineItems);

          const balanceTransaction = new BalanceTransaction(policyId, entityId, version, payment, termEffectiveDate);
          disbursementPayload.referenceId = balanceTransaction.typeDate;

          // Create disbursement
          const [disbursement] = await createDisbursements(entityId, disbursementPayload, transEffectiveDate);
          payment.disbursementId = disbursement.pk;

          // Put transaction with payment into balance table with pending status and update after disbursement is released.
          await recordTransaction(balanceTransaction);

          // If this was a SD cancellation and the policy is eleven pay billed we need to adjust installments
          if (!balanceDue) {
            if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay) {
              for (const installment of billing.paymentDetail.listOfInstallments) {
                if (installment.paid === false && installment.invoiceCreated === true) {
                  // If the installment hasn't been paid yet we need to regenerate installment invoices with the new amounts
                  installment.invoiceCreated = false;
                }
              }
              billing.billingStatus.invoiceStatus = BillingStatus.InvoiceStatus.Pending;
              billing.isStatementSent = false;
              await recalculateInstallments(billing);
              await updateBillingDates(billing);
              // After recalculating installments with the new amount due we need to regenerate the invoices

              await generateInvoice(policyId, billing);

              await generateStatementEvent(policyId, billing);
              await billingRepo.save(billing);
            }
            // If this is bill my lender TODO: Figure out the rules in that case
          }
        }
        break;

      // This event gets the Premium Refund Response from policy API to create Disbursement
      case ServiceEventProducer.DetailType.ProcessedRefund:
        // Create payment record from every payment that comes into the event
        for (const payment of event.detail.payments) {
          // Create disbursement as it comes from the event
          const disbursementPayload = new DisbursementPayload(payment);

          logTrace(loggerInfo, '🚀', `disbursementPayload`, disbursementPayload);

          const newPayment = await mapLineItemsToRefundPayment(payment.policyId, payment.lineItems, invoiceNumber);

          const balanceTransaction = new BalanceTransaction(
            policyId,
            entityId,
            detail.key.version,
            newPayment,
            termEffectiveDate
          );
          disbursementPayload.referenceId = balanceTransaction.typeDate;

          // Create disbursement
          const transactionDate = new Date().toISOString();
          const [disbursement] = await createDisbursements(entityId, disbursementPayload, transactionDate);
          newPayment.disbursementId = disbursement.pk;

          await ActivityLogProducer.sendActivityLog(
            policyId,
            billing.agencyEntityId,
            'Refund processed. Disbursement number: {{reference}}.',
            {
              reference: disbursement.disbursementNumber
            }
          );

          // Put transaction with payment into balance table with pending status and update after disbursement is released.
          await recordTransaction(balanceTransaction);
        }
        break;

      case ServiceEventProducer.DetailType.DisbursementUpdated:
        // Update the payment record in the balance table.
        const { referenceId: typeDate, state } = detail.disbursement;
        await updatePaymentStatus(policyId, typeDate, state);
        break;
      case ServiceEventProducer.DetailType.PolicyReinstatement:
        const newMainBalanceDue = new BalanceDue(balanceDue);
        logTrace(loggerInfo, '🚀', `balanceDue`, balanceDue);
        logTrace(loggerInfo, '🚀', `companionBalanceDue`, companionBalanceDue);
        if (newMainBalanceDue.subtotal < 0) {
          newMainBalanceDue.negateLineItems();
        }
        await recordBalanceDue(newMainBalanceDue, policyId, entityId, termEffectiveDate);

        // companionBalanceDue may come as undefined or with a subtotal as 0 and we need to handle them the same
        if (companionBalanceDue && companionBalanceDue.subtotal !== 0) {
          const newCompanionBalanceDue = new BalanceDue(companionBalanceDue);
          if (newCompanionBalanceDue.subtotal < 0) {
            newCompanionBalanceDue.negateLineItems();
          }

          await recordBalanceDue(newCompanionBalanceDue, policyId, entityId, termEffectiveDate);
          newMainBalanceDue.addLineItems(newCompanionBalanceDue.lineItems);
        }

        // If the disbursement does not exist, it means the cancellation was a non-payment.
        if (disbursementId) {
          const disbursementPayloadInput = {
            disbursementId,
            action: Actions.Reject
          };
          // Reject disbursement
          await requestDisbursementAction(Tenant.email, disbursementPayloadInput, true);

          // We need to update the payment record in the balance table so we create it when disbursement is updated
          const repository = new DisbursementRepository(client);
          const disbursement = await repository.getDisbursementById(disbursementId);
          const paymentStatus = new PaymentStatus();
          paymentStatus.state = Payment.PaymentStatus.Voided;
          paymentStatus.updatedDateTime = new Date().toISOString();
          const { payment } = await updatePaymentStatus(policyId, disbursement.referenceId, paymentStatus);

          const newPayment = new Payment(payment);
          newPayment.negateLineItems();
          newPayment.description = `Reinstate ${payment.description}`;
          newPayment.status = Payment.PaymentStatus.None;
          newPayment.processedDateTime = payment.processedDateTime || new Date().toISOString();

          const balanceTransaction = new BalanceTransaction(
            policyId,
            entityId,
            balanceDue?.version,
            newPayment,
            termEffectiveDate
          );
          // Put transaction with payment into balance table with pending status and update after disbursement is released.
          await recordTransaction(balanceTransaction);

          await updateBillingDates(billing);
          await billingRepo.save(billing);
        } else {
          await updateBillingFromReinstatement(policyId);
        }

        await ActivityLogProducer.sendActivityLog(policyId, billing.agencyEntityId, 'Policy reinstatement completed.', {
          cancelDate: billing.cancelDate
        });
        break;

      case ServiceEventProducer.DetailType.RegenerateStatement:
        await generateStatementEvent(policyId, billing, keys, true);
        await billingRepo.save(billing);
        break;

      case ServiceEventProducer.DetailType.PolicyIssuedChangeMortgagee:
        // Update mortgagee billing object with the data on the event.
        let mortgagee: MortgageeModel;

        if (mortgageeDetail) {
          mortgagee = {
            name: mortgageeDetail.companyName,
            loanNumber: mortgageeDetail.loanNumber,
            street: mortgageeDetail.address.line1,
            city: mortgageeDetail.address.city,
            state: mortgageeDetail.address.state,
            postalCode: mortgageeDetail.address.postalCode
          };

          billing.mortgagee = mortgagee;
        } else {
          // In case the mortgagee information arrives null/undefined it means no more primary mortgagee exists on the policy.
          delete billing.mortgagee;
        }

        await billingRepo.save(billing);

        break;

      default:
        throw new ExtendableError(`Action ${detailType} not handled.`, ErrorCodes.EVENT_NOT_HANDLED);
    }
  } catch (err) {
    console.error(err);
  }
};
