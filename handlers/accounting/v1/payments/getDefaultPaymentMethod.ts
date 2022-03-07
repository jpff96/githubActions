import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';
import { DefaultPaymentMethod } from '../../../bill2pay/models/DefaultPaymentMethod';
import { BillingRepository } from '../BillingRepository';
/**
 * get default payment method
 * @param req Request data.
 * @param res Response
 */
export const getDefaultPaymentMethod = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const policyId = decodeURIComponent(req.params.id);

    const repository = new BillingRepository(client);
    const paymentResult = await repository.get(policyId);

    let defaultPaymentMethod = new DefaultPaymentMethod(paymentResult.paymentMethod.defaultPaymentMethod);

    if (defaultPaymentMethod) {
      res.status(200).json(defaultPaymentMethod);
    } else {
      throw new NotFoundError(ErrorCodes.NotFound, 'Payment method Not Found');
    }
  } catch (error) {
    res.status(500).json(new ErrorResult(ErrorCodes.Unknown, error.message));
  }
};
