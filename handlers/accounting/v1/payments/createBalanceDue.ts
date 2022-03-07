import { logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import Tenant from '../../../../libs/Tenant';
import { validateSchema } from './validation/balanceDueValidator';
import { BalanceDue } from '../models/BalanceDue';
import { setBillingFromBalanceDue } from '../business/billing';
import { generateStatementEvent, getTotalBalanceDue, recordBalanceDue } from '../../../../libs/Utils';
import { PaymentPlan } from '../models/PaymentPlan';
import { PaymentDetail } from '../models/PaymentDetail';
import { getInstallmentFee, getListOfInstallmentsPrePolicyPayment } from '../business/installment';
import { addNewInvoiceFromInstallments } from '../schedule/invoicing';
import { Invoice } from '../models/Invoice';
import { BillingRepository } from '../BillingRepository';
import { client } from '../../../../libs/dynamodb';
import { PaymentUserInformation } from '../models/PaymentUserInformation';
import { addDays, formatISO, parseISO } from 'date-fns';
import { MortgageeModel } from '../../../mortgageeList/v1/models/MortgageeModel';
import { LineItems } from '../models/LineItems';
import { LineItem } from '../models/LineItem';

/**
 * Set balance due method
 * @param req Request data.
 * @param res Response
 */
export const createBalanceDue = async (req: Request, res: Response): Promise<void> => {
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');

  try {
    // Load incoming data from event
    Tenant.init(req);
    const { body } = req;
    // Validate the incoming request
    validateSchema(body);

    const { policyId, agencyEntityId, termEffectiveDate, termExpirationDate, productKey, ownerEntityId, customerId } = body;

    const paymentPlan = new PaymentPlan(body.paymentPlan);

    let mainBalanceDue: BalanceDue, companionBalanceDue: BalanceDue;
    if (body.mainBalanceDue) {
      mainBalanceDue = new BalanceDue(body.mainBalanceDue);
      await recordBalanceDue(mainBalanceDue, policyId, ownerEntityId, termEffectiveDate);
      await setBillingFromBalanceDue(
        policyId,
        agencyEntityId,
        mainBalanceDue,
        termEffectiveDate,
        termExpirationDate,
        productKey,
        ownerEntityId
      );

      logTrace(loggerInfo, '🚀', 'createBalanceDue-mainBalanceDue', mainBalanceDue);
    }

    if (body.companionBalanceDue) {
      companionBalanceDue = new BalanceDue(body.companionBalanceDue);
      await recordBalanceDue(companionBalanceDue, policyId, ownerEntityId, termEffectiveDate);
      await setBillingFromBalanceDue(
        policyId,
        agencyEntityId,
        companionBalanceDue,
        termEffectiveDate,
        termExpirationDate,
        productKey,
        ownerEntityId
      );

      logTrace(loggerInfo, '🚀', 'createBalanceDue-companionBalanceDue', companionBalanceDue);
    }

    let mortgagee: MortgageeModel;
    if (body.mortgagee) {
      mortgagee = {
        name: body.mortgagee.companyName,
        loanNumber: body.mortgagee.loanNumber,
        street: body.mortgagee.address.line1,
        city: body.mortgagee.address.city,
        state: body.mortgagee.address.state,
        postalCode: body.mortgagee.address.postalCode
      };
    }

    await createInvoiceAndUpdateBillingInformation(policyId, paymentPlan, customerId, ownerEntityId, mortgagee);

    res.status(201).json({ mainBalanceDue, companionBalanceDue });
  } catch (ex) {
    logTrace(loggerInfo, '🚀', 'createBalanceDue-catch-error', ex);
    res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex.message));
  }
};

/**
 * Create the first invoice, update billing information and generate statement event.
 * @param policyId The policy Id
 * @param paymentPlan The payment plan data of the policy
 * @param customerId The customer Id
 * @param ownerEntityId The owner entity Id
 * @param mortgagee The mortgagee data for bill my lender policies.
 */
const createInvoiceAndUpdateBillingInformation = async (
  policyId: string,
  paymentPlan: PaymentPlan,
  customerId: string,
  ownerEntityId: string,
  mortgagee: MortgageeModel
) => {
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);

  logTrace(loggerInfo, '🚀', 'createBalanceDue-createInvoiceAndUpdateBillingInformation-billing', billing);

  billing.paymentPlan = paymentPlan;
  billing.accountNumber = billing.policyNumber;

  // We need to save the customerId of the user and the entityId.
  billing.userInformation = new PaymentUserInformation();
  billing.userInformation.customerId = customerId;
  billing.userInformation.entityId = ownerEntityId;

  // We create a new instance of the PaymentDetail class so we can use addLineItem function to correctly add the line items
  const paymentDetail = new PaymentDetail(billing.paymentDetail);
  const totalBalanceDue = await getTotalBalanceDue(billing.pk, billing.effectiveDate);
  const totalPremiumDue = totalBalanceDue.getTotalPremiums(LineItem.AccountType.Main);

  logTrace(
    loggerInfo,
    '🚀',
    'createBalanceDue-createInvoiceAndUpdateBillingInformation-totalBalanceDue',
    totalBalanceDue
  );
  logTrace(
    loggerInfo,
    '🚀',
    'createBalanceDue-createInvoiceAndUpdateBillingInformation-totalPremiumDue',
    totalPremiumDue
  );

  // Policy equity is calculated using premiums divided by 365 which results in equity per day
  billing.policyEquity = totalPremiumDue / 365;

  if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay) {
    paymentDetail.installmentsLeft = 11;
    paymentDetail.installmentFee = getInstallmentFee(totalPremiumDue);
    paymentDetail.listOfInstallments = getListOfInstallmentsPrePolicyPayment(
      paymentDetail.installmentFee,
      billing.effectiveDate,
      totalBalanceDue
    );

    logTrace(
      loggerInfo,
      '🚀',
      'createBalanceDue-createInvoiceAndUpdateBillingInformation-paymentDetail',
      paymentDetail
    );

    // We manually create the first invoice
    if (paymentDetail.listOfInstallments.length > 0) {
      const invoice = await addNewInvoiceFromInstallments(billing, paymentDetail.listOfInstallments[0]);

      logTrace(loggerInfo, '🚀', 'createBalanceDue-createInvoiceAndUpdateBillingInformation-invoice', invoice);

      // Now we mark the first installment as invoiceCreated = true
      paymentDetail.listOfInstallments[0].invoiceCreated = true;
    } else {
      throw new Error('List of Installments not found');
    }
  } else if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.FullPay) {
    const newInvoice = await Invoice.createNewInvoice(
      billing.ownerEntityId,
      billing.pk,
      Invoice.InvoiceType.FullPremiumPayment,
      billing.policyNumber,
      billing.productKey,
      billing.effectiveDate
    );

    if (billing.paymentPlan.responsibleParty === PaymentPlan.ResponsibleParty.Mortgagee) {
      billing.mortgagee = mortgagee;
      // We set the cancel date 30 days after the policy effective date TODO: Pull this value from product configuration
      billing.cancelDate = formatISO(addDays(parseISO(billing.effectiveDate), 30), {
        representation: 'date'
      });
      // We set the due date 15 days after the policy effective date TODO: Pull this value from product configuration
      billing.dueDate = formatISO(addDays(parseISO(billing.effectiveDate), 15), {
        representation: 'date'
      });

      newInvoice.dueDate = billing.dueDate;
    }

    newInvoice.addLineItems(totalBalanceDue.lineItems);
    await billingRepo.saveInvoice(newInvoice);
    logTrace(loggerInfo, '🚀', 'createBalanceDue-createInvoiceAndUpdateBillingInformation-newInvoice', newInvoice);
  }
  billing.paymentDetail = paymentDetail;

  // Send statement event
  billing.isStatementSent = false;
  await generateStatementEvent(policyId, billing);

  await billingRepo.save(billing);
};
