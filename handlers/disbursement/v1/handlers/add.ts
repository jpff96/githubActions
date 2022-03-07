import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { createDisbursements } from '../helpers/createDisbursements';
import { DisbursementPayload } from '../models';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';

/**
 * Adds a new disbursement.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const add = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const createdDisbursements = await createDisbursements(Tenant.tenantEntityId, new DisbursementPayload(req.body));

    res.status(200).json(createdDisbursements);
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
