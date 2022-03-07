import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import Tenant from '../../../../libs/Tenant';
import { Request, Response } from 'express';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { client } from '../../../../libs/dynamodb';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import { BillingRepository } from '../BillingRepository';
import { getReinstatmentLineItems } from '../business/reinstatement';
import { EntityAPI } from '../../../../libs/API/EntityAPI';
import { Configuration } from '../../../../libs/constLib';
import { Bill2Pay } from '../../../bill2pay/bill2Pay';
import { InitializeRequest } from '../../../bill2pay/models/InitializeRequest';
import { PaymentInformationResponse } from '../../../bill2pay/models/PaymentInformationResponse';
import { Bill2PayPaymentSources } from '../../../../libs/enumLib';

/**
 * Gets reinstatement token and amount.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const generateReinstatementToken = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const reqBody = req.body;
    const initializeRequest = new InitializeRequest(reqBody);
    const billingRepo = new BillingRepository(client);
    const billing = await billingRepo.get(initializeRequest.policyId);
    const { settings } = await EntityAPI.getApiConfig(Tenant.tenantEntityId, Configuration.API_SIG);
    const initResult = new PaymentInformationResponse();
    //We have to save this cancel Date to use it when we actually recieve that payment.
    billing.cancellationDate = reqBody.cancelDate;

    // We populate the initalizerequest with the correct information
    initializeRequest.paymentPlan = billing.paymentPlan.planType;
    initializeRequest.accountNumber = reqBody.accountNumber;
    initializeRequest.policyNumber = billing.policyNumber;
    initializeRequest.productName = billing.productKey;
    initializeRequest.paymentSource = Bill2PayPaymentSources.PORTAL;
    initializeRequest.customerId = billing.userInformation.customerId;
    initializeRequest.allowCreditCard = initializeRequest.allowECheck = true;

    const lineItems = await getReinstatmentLineItems(initializeRequest.policyId, billing);
    initializeRequest.amount = lineItems.subtotal;

    // Call out to the provider to make the transaction token
    const bill2Pay = new Bill2Pay();
    await bill2Pay.getPaymentTransactionToken(initializeRequest, settings, initResult);

    if (initResult.transactionToken) {
      // transaction token must be saved in order to access payment information
      billing.paymentDetail.transactionToken = initResult.transactionToken;

      await billingRepo.save(billing);
      res.status(200).json({ initResult, lineItems });
    } else {
      throw new NotFoundError(ErrorCodes.NotFound, 'Not Found');
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
