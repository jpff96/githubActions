import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { WalletResponse } from './models/WalletResponse';
import { Bill2Pay, evenRound } from './bill2Pay';
import { Configuration } from '../../libs/constLib';
import { EntityAPI } from '../../libs/API/EntityAPI';
import { ErrorCodes } from '../../libs/errors/ErrorCodes';
import { GenerateWalletToken } from './models/GenerateWalletToken';
import { Request, Response } from 'express';
import Tenant from '../../libs/Tenant';
import { validateSchema } from './validation/walletTokenValidator';

/**
 * Entry point for to setup a transaction for Payment providers like Bill2Pay that need this
 * preliminary step.
 *
 * @param req      Event data.
 * @param res      Response.
 *
 * @return Response object containing metadata or error message.
 */
export const main = async (req: Request, res: Response) => {
  // Declare global variables

  try {
    // Load incoming data from event body
    Tenant.init(req)
    const tenantId = Tenant.tenantEntityId;

    // Lookup the configuration information to pass to the provider
    const { settings } = await EntityAPI.getApiConfig(tenantId, Configuration.API_SIG);
    const walletResult = new WalletResponse();

    const reqBody = req.body;
    validateSchema(reqBody);
    const initializeRequest = new GenerateWalletToken(reqBody);

    // Call out to the provider to make the payment
    const bill2Pay = new Bill2Pay();
    await bill2Pay.getWalletTransactionToken(initializeRequest, settings, walletResult);

    switch (walletResult.resultCode) {
      case 201:
        res.status(201).json(walletResult);
        break;
      case 200:
        //TODO: Response on wallet returns 200 and not 201
        res.status(200).json(walletResult);
        break;
      case 400:
        res
          .status(400)
          .json(new ErrorResult<ErrorCodes>(ErrorCodes.InvalidData, 'Bad Request – Invalid transaction object'));
        break;
      case 401:
        // TODO Update ResponseHelper to include unauthorized response
        res
          .status(401)
          .json(
            new ErrorResult<ErrorCodes>(
              ErrorCodes.MissingSecurityHeader,
              'Unauthorized – Invalid or missing security key header'
            )
          );
        break;
      default:
        res.status(500).json(new ErrorResult(ErrorCodes.Unknown, 'Unexpected error'));
        break;
    }
  } catch (ex) {
    console.error(ex);
    res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex));
  }
};