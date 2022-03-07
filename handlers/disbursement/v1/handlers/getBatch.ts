import { ErrorResult, safeQueryParam } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';
import { DisbursementRepository } from '../DisbursementRepository';
import { getDisbursementType } from '../helpers/getType';
import { Disbursement } from '../models/Disbursement';
import { validateBatchType } from '../validation/batchTypeValidation';

/**
 * Gets a batch.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const getBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const batchId = decodeURIComponent(req.params.id);

    // Batch type (Batch or Claim)
    let batchType = DisbursementRepository.BatchRecordType.Batch;
    const queryBatchType = safeQueryParam(req.query, 'batchType');

    if (queryBatchType) {
      validateBatchType(queryBatchType);

      batchType =
        DisbursementRepository.BatchRecordType[queryBatchType] || DisbursementRepository.BatchRecordType.Batch;
    }

    const repository = new DisbursementRepository(client);
    let disbursements: Array<Disbursement>;
    const batch = await repository.getRecord(batchId, batchType);

    if (batch) {
      const disbursementType = getDisbursementType(batchType);

      disbursements = await repository.getDisbursements(batch.pk, { disbursementType });
    }

    res.status(200).json({ batch, disbursements });
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
