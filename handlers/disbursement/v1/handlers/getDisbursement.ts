import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';
import { DisbursementRepository } from '../DisbursementRepository';
import { validateDisbursementType } from '../validation/disbursementTypeValidation';

/**
 * Gets a batch.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const getDisbursement = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const disbursementId = decodeURIComponent(req.params.id);

    // Disbursement type (Disbursement or ClaimDisbursement)
    let disbursementType: DisbursementRepository.DisbursementRecordType =
      DisbursementRepository.DisbursementRecordType.Disbursement;

    if (req.query.disbursementType) {
      validateDisbursementType(req.query.disbursementType.toString());

      disbursementType =
        DisbursementRepository.DisbursementRecordType[req.query.disbursementType.toString()] ||
        DisbursementRepository.DisbursementRecordType.Disbursement;
    }

    const repository = new DisbursementRepository(client);

    const disbursement = await repository.getDisbursement(disbursementId, disbursementType);

    res.status(200).json({ disbursement: disbursement });
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
