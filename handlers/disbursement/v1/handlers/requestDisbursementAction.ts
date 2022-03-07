import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { ErrorCodes, NotFoundError } from '../../../../libs/errors';
import { logError } from '../../../../libs/logLib';
import Tenant from '../../../../libs/Tenant';
import { requestDisbursementAction as requestDisbursementActionHelper } from '../helpers/requestDisbursementAction';

/**
 * Request an action to change the status for a disbursement record
 * @param req Request data
 * @param res Response data
 * @returns Empty promise
 */
export const requestDisbursementAction = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const disbursementId = decodeURIComponent(req.params.id);
    
    const { action, 
            disbursementType, 
            paymentId, 
            rejectReason, 
            returnEvent 
    } = req.body
    const disbursementActionPayload = { action, disbursementType, paymentId, rejectReason, returnEvent }

    const savedDisbursement = await requestDisbursementActionHelper(Tenant.email, { ...disbursementActionPayload, disbursementId });
    res.status(200).json(savedDisbursement);
  } catch (ex) {
    logError(console.error, ex, 'requestDisbursementhAction');

    if (ex instanceof NotFoundError) {
      res.status(404).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else if (ex instanceof ErrorResult) {
      res.status(400).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else {
      res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex.message));
    }
  }
};
