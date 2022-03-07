import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import Tenant from '../../../../libs/Tenant';
import { Request, Response } from 'express';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { client } from '../../../../libs/dynamodb';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import { BillingRepository } from '../BillingRepository';

/**
 * Gets balance record(s).
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const getBillingInformation = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const policyId = decodeURIComponent(req.params.id);

    const repository = new BillingRepository(client);
    const billing = await repository.get(policyId);

    if (billing) {
      const invoices = await repository.getAllInvoices(policyId);
      billing.paymentDetail.invoices = invoices;

      res.status(200).json(billing);
    } else {
      throw new NotFoundError(ErrorCodes.NotFound, 'Not Found');
    }
  } catch (ex) {
    console.error(ex);

    if (ex instanceof NotFoundError) {
      res.status(404).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else if (ex instanceof ErrorResult) {
      res.status(400).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else {
      res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex.message));
    }
  }
};
