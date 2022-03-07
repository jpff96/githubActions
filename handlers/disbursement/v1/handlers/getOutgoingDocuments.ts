import { Request, Response } from 'express';
import Tenant from '../../../../libs/Tenant';
import { DisbursementRepository } from '../DisbursementRepository';
import { client } from '../../../../libs/dynamodb';
import { Disbursement } from '../models/Disbursement';
import { OutgoingDocument } from '../models/OutgoingDocument';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers/dist/httpHelpers/errors';
import { safeQueryParam } from '@eclipsetechnology/eclipse-api-helpers/dist/helpers';
import { OutgoingDocumentResponse } from '../models/OutgoingDocumentResponse';
import { validateDisbursementStateFilter } from '../validation/disbursementStateValidation';

/**
 * Gets list of outgoing documents
 * @param req Request data.
 * @param res Response
 */
export const getOutgoingDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    // Take paging
    let take: number;
    const takeQueryStringParam = safeQueryParam(req.query, 'take');

    if (takeQueryStringParam) {
      take = Number(takeQueryStringParam);
    }

    // Last key filter
    let lastEvaluatedKey;
    const queryKey = safeQueryParam(req.query, 'lastEvaluatedKey');
    if (queryKey) {
      if (typeof queryKey === 'string') {
        lastEvaluatedKey = JSON.parse(queryKey);
      } else if (typeof queryKey === 'object') {
        lastEvaluatedKey = queryKey;
      }
    }

    // Disbursement state filter
    let state: Disbursement.States;
    const queryStateFilter = safeQueryParam(req.query, 'state');

    if (queryStateFilter) {
      validateDisbursementStateFilter(queryStateFilter);

      if (queryStateFilter !== Disbursement.States.None) {
        state = Disbursement.States[queryStateFilter];
      }
    }

    // Disbursement time period filter
    const startDateTime = safeQueryParam(req.query, 'startDateTime');
    const endDateTime = safeQueryParam(req.query, 'endDateTime');

    //Disbursement referenceNumber filter
    const referenceNumber = safeQueryParam(req.query, 'referenceNumber');

    const repository = new DisbursementRepository(client);
    const disbursementType = DisbursementRepository.DisbursementRecordType.DisbursementPrint;

    const result = await repository.getDisbursementList(
      Tenant.tenantEntityId,
      disbursementType,
      {
        state,
        startDateTime,
        endDateTime,
        referenceNumber
      },
      take,
      lastEvaluatedKey
    );

    const outgoingDocuments: OutgoingDocument[] = getDocuments(result.disbursements);
    const response = new OutgoingDocumentResponse({
      outgoingDocuments, lastEvaluatedKey: result.lastEvaluatedKey
    });

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

/**
 * Returns outgoing documents from a disbursement list
 * @param disbursements disbursement list
 */
const getDocuments = (disbursements: Disbursement[]): OutgoingDocument[] => {
  const outgoingDocuments: OutgoingDocument[] = [];

  for (const disbursement of disbursements) {
    const { documentKeyList, recipients, state, disbursementHistory } = disbursement;

    const recipient = recipients.find((recipient) => recipient.isDefaultRecipient);
    const { firstName: recipientFirstName, lastName: recipientLastName } = recipient;

    const status = state;
    const documentHistory = disbursementHistory;

    for (const [i, document] of documentKeyList.entries()) {
      const outgoingDocument = new OutgoingDocument({
        ...disbursement,
        id: `${disbursement.disbursementNumber}_${i}`,
        documentKey: document,
        recipientFirstName,
        recipientLastName,
        status,
        documentHistory
      });

      outgoingDocuments.push(outgoingDocument);
    }
  }

  return outgoingDocuments;
};
