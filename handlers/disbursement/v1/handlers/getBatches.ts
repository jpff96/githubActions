import { ErrorResult, safeQueryParam } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';
import { DisbursementRepository } from '../DisbursementRepository';
import { validateBatchType } from '../validation/batchTypeValidation';
import { validateStateFilter } from '../validation/filterValidation';
import { getDisbursementType } from '../helpers/getType';
import { BatchList, BatchResponse, Disbursement } from '../models';
import { validateDisbursementStateFilter } from '../validation/disbursementStateValidation';
import { DisbursementListDTO } from '../models/DisbursementListDTO';

/**
 * Gets list of batches.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const getBatches = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    // Batch type (Batch or Claim)
    let batchType: DisbursementRepository.BatchRecordType = DisbursementRepository.BatchRecordType.Batch;
    const queryBatchType = safeQueryParam(req.query, 'batchType');

    if (queryBatchType) {
      validateBatchType(queryBatchType);
      batchType = DisbursementRepository.BatchRecordType[queryBatchType];
    }

    // Batch state filter
    let batchStateFilter: DisbursementRepository.BatchStateFilters;
    const queryBatchStateFilter = safeQueryParam(req.query, 'batchStateFilter');

    if (queryBatchStateFilter) {
      validateStateFilter(queryBatchStateFilter);

      if (queryBatchStateFilter !== DisbursementRepository.BatchStateFilters.None) {
        batchStateFilter = DisbursementRepository.BatchStateFilters[queryBatchStateFilter];
      }
    }

    // Take paging
    let take: number = 15;
    const queryTake = safeQueryParam(req.query, 'take');

    if (queryTake) {
      take = Number(queryTake);
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

    let response: BatchList | DisbursementListDTO;
    const repository = new DisbursementRepository(client);

    // Check if return disbursements
    const returnDisbursements = safeQueryParam(req.query, 'returnDisbursements').toLowerCase() === 'true';

    if (returnDisbursements === true) {
      const disbursementType = getDisbursementType(batchType);

      // Disbursement state filter
      let disbursementState: Disbursement.States;
      const queryDisbursementStateFilter = safeQueryParam(req.query, 'disbursementStateFilter');

      if (queryDisbursementStateFilter) {
        validateDisbursementStateFilter(queryDisbursementStateFilter);

        if (queryDisbursementStateFilter !== Disbursement.States.None) {
          disbursementState = Disbursement.States[queryDisbursementStateFilter];
        }
      }

      // Disbursement time period filter
      const startDateTime = safeQueryParam(req.query, 'startDateTime');
      const endDateTime = safeQueryParam(req.query, 'endDateTime');

      const result = await repository.getDisbursementList(
        Tenant.tenantEntityId,
        disbursementType,
        {
          state: disbursementState,
          startDateTime,
          endDateTime
        },
        take,
        lastEvaluatedKey
      );

      const disbursementListDTO = DisbursementListDTO.loadFromSource(result);
      const batchList: BatchResponse[] = [];

      // Update batch information for all disbursements
      for (const disbursement of disbursementListDTO.disbursements) {

        // Check if batch already exists in batchList
        let batch = batchList.find((b) => b.pk === disbursement.batchId);

        if (!batch) {
          // Get batch from DB and push to batchList
          batch = await repository.getBatchById(disbursement.batchId, batchType);
          batchList.push(batch);
        }

        disbursement.scheduledDateTime = batch.scheduledDateTime;
        disbursement.releasedDateTime = batch.releasedDateTime;
      }

      response = disbursementListDTO;
    } else {
      const batchList = await repository.getBatchList(
        Tenant.tenantEntityId,
        batchType,
        { state: batchStateFilter },
        take,
        lastEvaluatedKey
      );

      response = batchList;
    }

    res.status(200).json(response);
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
