import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import Tenant from '../../../../libs/Tenant';
import { DefaultPaymentMethod } from '../../../bill2pay/models/DefaultPaymentMethod';
import { BillingRepository } from '../BillingRepository';
import { validateSchema } from './validation/setPaymentMethodValidator';
import { BillingStatus } from '../models/BillingStatus';
import { clearPaymentAttempted } from '../business/invoicing';

/**
 * Set default payment method
 * @param req Request data.
 * @param res Response
 */
export const setDefaultPaymentMethod = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);
    const reqBody = req.body;
    validateSchema(reqBody);
    const policyId = reqBody.policyId;
    const defaultPaymentMethod = reqBody.paymentMethod;
    await saveDefaultPaymentMethod(policyId, defaultPaymentMethod);

    const billingRepo = new BillingRepository(client);
    const invoices = await billingRepo.getAllInvoices(policyId);

    // Now that the payment plan has been changed we should clear paymentAttempted flag on invoices
    // so that they can be processed again correctly
    const updatedInvoies = await clearPaymentAttempted(invoices);
    await billingRepo.saveInvoices(updatedInvoies);

    res.status(200).json({ defaultPaymentMethod });
  } catch (error) {
    res.status(500).json(new ErrorResult(ErrorCodes.Unknown, error.message));
  }
};

/**
 * Save default payment method
 * @param policyId Policy Id to get proper billing info.
 * @param defaultPaymentMethod Payment method selected to be charged.
 */
export const saveDefaultPaymentMethod = async (policyId, defaultPaymentMethod) => {
  const repository = new BillingRepository(client);
  let billing = await repository.get(policyId);

  billing.paymentMethod.defaultPaymentMethod = new DefaultPaymentMethod(defaultPaymentMethod);

  const result = await repository.save(billing);

  return result;
};
