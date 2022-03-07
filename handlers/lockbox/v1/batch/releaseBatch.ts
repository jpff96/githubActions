import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import { logError } from '../../../../libs/logLib';
import Tenant from '../../../../libs/Tenant';
import { LockboxRepository } from '../LockboxRepository';
import { BatchHelper } from '../schedule/BatchHelper';

/**
 * Release a batch.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const releaseBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const batchId = decodeURIComponent(req.params.id);

    const repository = new LockboxRepository(client);
    const batch = await repository.getBatch(batchId);

    if (batch) {
      try {
        // TODO - a lock will be necessary here to ensure a transaction is only applied once.
        await BatchHelper.releaseBatch(batch);
      } catch (ex) {
        logError(console.log, ex, 'releaseBatch');
      }

      res.status(200).json(batch);
    } else {
      throw new NotFoundError(ErrorCodes.NotFound, 'Batch not found.');
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
