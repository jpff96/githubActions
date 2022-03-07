import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Client } from '@elastic/elasticsearch';
import { Request, Response } from 'express';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';

/**
 * Main entry point for payment search through elasticsearch.
 * @param req Request data.
 * @param res Response
 */
export const search = async (req: Request, res: Response): Promise<void> => {
  const {
    ES_ENDPOINT,
    ES_PAYMENT_SEARCH_INDEX,
    ES_LOCKBOX_SEARCH_INDEX,
    ES_SEARCH_TYPE,
    ES_USERNAME,
    ES_PASSWORD
  } = process.env;

  const client = new Client({
    node: ES_ENDPOINT,
    auth: {
      username: ES_USERNAME,
      password: ES_PASSWORD
    }
  });

  try {
    const { criteria, skip, take } = req.query;

    if (criteria) {
      Tenant.init(req);
      const entityId = Tenant.tenantEntityId.replace(/-/g, '');

      // Default skip if not a number
      const reqSkip = Number(skip) || 0;

      // Default take if not a number
      const reqTake = Number(take) || 25;

      // Format criteria
      let reqCriteria = criteria.toString().replace(/\s/g, '* *');

      const reqBody = {
        query: {
          query_string: {
            query: `agencyEntityIds:${entityId} AND (*${reqCriteria}*)`
          }
        }
      };

      const { body } = await client.search({
        index: `${ES_PAYMENT_SEARCH_INDEX},${ES_LOCKBOX_SEARCH_INDEX}`,
        type: ES_SEARCH_TYPE,
        body: reqBody,
        from: reqSkip,
        size: reqTake
      });

      res.status(200).json(body.hits);
    } else {
      throw new NotFoundError(ErrorCodes.CriteriaNotFound, 'Search criteria not found');
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
