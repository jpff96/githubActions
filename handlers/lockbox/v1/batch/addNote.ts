import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';
import { LockboxRepository } from '../LockboxRepository';
import { validateNote } from '../validation/noteValidation';

/**
 * Add a note to a batch record.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const addNote = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const batchId = decodeURIComponent(req.params.id);
    const transId = decodeURIComponent(req.params.transId);
    validateNote(req.body);

    const repository = new LockboxRepository(client);
    const transaction = await repository.updateNote(batchId, transId, req.body.note);

    if (transaction) {
      res.status(200).json(transaction);
    } else {
      res.status(404).json(new ErrorResult(ErrorCodes.NotFound, 'Transaction not found.'));
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
