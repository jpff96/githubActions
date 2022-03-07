import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';
import { LockboxRepository } from '../LockboxRepository';
import { validateStatusFilter } from '../validation/filterValidation';

/**
 * Gets batch records.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const getBatches = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    // Status filter
    let statusFilter: LockboxRepository.StatusFilters;

    if (req.query.statusFilter) {
      validateStatusFilter(req.query.statusFilter.toString());

      statusFilter =
        LockboxRepository.StatusFilters[req.query.statusFilter.toString()] || LockboxRepository.StatusFilters.None;
    }

    // Take paging
    let take: number;

    if (req.query.take) {
      take = Number(req.query.take.toString());
    }

    // Last key filter
    let lastEvaluatedKey;
    const queryKey = req.query.lastEvaluatedKey;
    
    if (queryKey) {

      if (typeof queryKey === 'string') {

        lastEvaluatedKey = JSON.parse(queryKey);

      } else if (typeof queryKey === 'object') {

        lastEvaluatedKey = queryKey;

      }
    }

    const repository = new LockboxRepository(client);
    const batchList = await repository.getList(Tenant.tenantEntityId, statusFilter, take, lastEvaluatedKey);

    res.status(200).json(batchList);
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
