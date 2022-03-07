import { ErrorResult, logError, logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import Tenant from '../../../../libs/Tenant';
import { generateStatementEvent, getAmountDueLeft, mapPaymentPlan } from '../../../../libs/Utils';
import { DefaultPaymentMethod } from '../../../bill2pay/models/DefaultPaymentMethod';
import { BillingRepository } from '../BillingRepository';
import { removeElectronicPaymentMethods, updateBillingDates } from '../business/billing';
import { closeOpenInvoices } from '../business/invoicing';
import { ChangeBillingMethodRequest } from '../models/ChangeBillingMethodRequest';
import { Installment } from '../models/Installment';
import { Invoice } from '../models/Invoice';
import { PaymentPlan } from '../models/PaymentPlan';
import { validateSchema } from './validation/changeBillingMethodValidator';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { addDays, formatISO } from 'date-fns';

/**
 * Change the billing method endpoint
 * @param req Request
 * @param res Response
 * @returns An empty promise.
 */
export const changeBillingMethod = async (req: Request, res: Response): Promise<void> => {
  // Load incoming data from event
  Tenant.init(req);

  // Validate the incoming object
  validateSchema(req.body);

  try {
    const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');
    const changeBillingMethodRequest = new ChangeBillingMethodRequest(req.body);
    const { policyId, paymentPlan: newPaymentPlan, responsibleParty: newResponsibleParty } = changeBillingMethodRequest;
    const billingRepo = new BillingRepository(client);
    const billing = await billingRepo.get(policyId);
    const { responsibleParty, planType: paymentPlan } = billing.paymentPlan;
    logTrace(loggerInfo, '🚀', `Change Billing Method process started. Request:`, changeBillingMethodRequest);

    if (paymentPlan === newPaymentPlan && responsibleParty === newResponsibleParty) {
      throw new Error('Not able to change billing method - must be different from the current one');
    }

    const mappedPaymentPlan = mapPaymentPlan(billing.paymentPlan);

    // If we the billing method is changing to Mortgagee billed we have to remove all saved payment methods
    if (newResponsibleParty === PaymentPlan.ResponsibleParty.Mortgagee) {
      await removeElectronicPaymentMethods(billing);

      billing.paymentMethod.defaultPaymentMethod = new DefaultPaymentMethod();
    }

    // If we the billing method is changing to Full pay we have to update the lastReinstatementDate
    if (newResponsibleParty === PaymentPlan.ResponsibleParty.Insured) {
      const lastReinstatementDateDetail = ServiceEventProducer.createPaymentPlanChange(
        formatISO(addDays(new Date(), 1)),
        policyId,
        paymentPlan,
        newPaymentPlan,
        newResponsibleParty
      );
      ServiceEventProducer.sendServiceEvent(
        lastReinstatementDateDetail,
        ServiceEventProducer.DetailType.PaymentPlanChange
      );
    }

    billing.paymentPlan.planType = newPaymentPlan;
    billing.paymentPlan.responsibleParty = newResponsibleParty;

    switch (newPaymentPlan) {
      case PaymentPlan.PaymentPlanType.ElevenPay:
        // TODO: Handle changing from FullPay to ElevenPay
        break;

      case PaymentPlan.PaymentPlanType.FullPay:
        const amountDueLeft = await getAmountDueLeft(policyId, billing.effectiveDate);

        // If there is nothing left in the policy then there is nothing to be done
        if (amountDueLeft.subtotal !== 0) {
          const unsavedInvoices = await closeOpenInvoices(billing);

          const newInvoice = await Invoice.createNewInvoice(
            billing.ownerEntityId,
            policyId,
            Invoice.InvoiceType.FullPremiumPayment,
            billing.policyNumber,
            billing.productKey,
            billing.dueDate
          );
          newInvoice.addLineItems(amountDueLeft.lineItems);
          unsavedInvoices.push(newInvoice);

          await billingRepo.saveInvoices(unsavedInvoices);

          // Remove unpaid installments
          const paidInstallments = billing.paymentDetail.listOfInstallments.filter((i) => i.paid === true);
          billing.paymentDetail.listOfInstallments = paidInstallments ?? new Array<Installment>();

          billing.isStatementSent = false;
          await updateBillingDates(billing);
          await generateStatementEvent(policyId, billing, null, null, unsavedInvoices);
        }
        break;

      default:
        break;
    }

    await billingRepo.save(billing);

    const newMappedPaymentPlan = mapPaymentPlan(billing.paymentPlan);
    // Create payment changed activity log entry
    await ActivityLogProducer.sendActivityLog(
      policyId,
      billing.agencyEntityId,
      'The payment plan has been changed from {{mappedPaymentPlan}} to {{newMappedPaymentPlan}}.',
      {
        mappedPaymentPlan: mappedPaymentPlan,
        newMappedPaymentPlan: newMappedPaymentPlan
      }
    );

    res.sendStatus(200);
  } catch (ex) {
    console.error(ex);
    logError(console.log, ex, 'Unable to change billing method');

    if (ex.code === 'ConditionalCheckFailedException') {
      res.status(409).json(new ErrorResult(ErrorCodes.ResourceAlreadyExists, ex.message));
    } else if (ex instanceof ErrorResult) {
      res.status(400).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else {
      res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex.message));
    }
  }
};
