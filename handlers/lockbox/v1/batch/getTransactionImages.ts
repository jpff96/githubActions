import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { MediaAPI } from '../../../../libs/API/MediaAPI';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';
import { LockboxRepository } from '../LockboxRepository';
import { ImageResponse } from '../models/ImageResponse';
import { ImagesResponse } from '../models/ImagesResponse';

/**
 * Gets batch transaction record images.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const getTransactionImages = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const batchId = decodeURIComponent(req.params.id);
    const transId = decodeURIComponent(req.params.transId);

    const repository = new LockboxRepository(client);
    const transaction = await repository.getTransaction(batchId, transId);

    if (transaction) {
      const response = new ImagesResponse();

      for (const image of transaction.images) {
        if (image.token) {
          const { file } = await MediaAPI.fetchMedia(image.token);
          const imageData = `data:${file.ContentType};${file.ContentEncoding},${file.Body.toString('base64')}`;
          response.images.push(new ImageResponse(image.side, image.name, imageData));
        }
      }

      res.status(200).json(response);
    } else {
      throw new NotFoundError(ErrorCodes.NotFound, 'Transaction not found.');
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
