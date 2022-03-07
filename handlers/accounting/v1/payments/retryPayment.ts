import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import Tenant from '../../../../libs/Tenant';
import { BillingRepository } from '../BillingRepository';
import { validateSchema } from './validation/retryPaymentValidator';
import { triggerInstallment } from '../schedule/installments';

/**
 * Retry payment with a specific payment method
 * @param req Request data.
 * @param res Response
 */
export const retryPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    Tenant.init(req);
    const reqBody = req.body;
    validateSchema(reqBody);
    const policyId = reqBody.policyId;
    const paymentMethodToken = reqBody.paymentMethodToken;

    // Right now this only works in eleven pay policies.
    // Can be adjusted in the future for full pay policies renew.
    const billingRepo = new BillingRepository(client);
    const result = await triggerInstallment(policyId, billingRepo, paymentMethodToken);
    const status = result?.status ?? 200;

    res.status(status).json({ result });
  } catch (error) {
    res.status(500).json(new ErrorResult(ErrorCodes.Unknown, error.message));
  }
};
