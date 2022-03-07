import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import Tenant from '../../../../libs/Tenant';
import { Response } from 'express';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { validateSchema } from './validation/installmentsCalculatorValidator';
import { getInstallmentInfo } from '../business/installment';
import { InstallmentCalculatorRequest } from '../models/InstallmentCalculatorRequest';
/**
 * Gets blling record(s).
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const installmentsCalculator = async (req, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);
    const reqBody = req.body;
    validateSchema(reqBody);

    const installmentsCalcData = new InstallmentCalculatorRequest(reqBody);
    const installmentsInfo = getInstallmentInfo(installmentsCalcData);

    res.status(200).json(installmentsInfo);
  } catch (ex) {
    console.error(ex);
    if (ex instanceof ErrorResult) {
      res.status(400).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else {
      res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex.message));
    }
  }
};
