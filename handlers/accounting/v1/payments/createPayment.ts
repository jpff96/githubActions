import { ErrorResult, logError } from '@eclipsetechnology/eclipse-api-helpers';
import Tenant from '../../../../libs/Tenant';
import { Request, Response } from 'express';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { client } from '../../../../libs/dynamodb';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { BillingStatus } from '../models/BillingStatus';
import { BillingRepository } from '../BillingRepository';
import { PaymentUserInformation } from '../models/PaymentUserInformation';
import { validateSchema } from './validation/createValidator';
import { handleNewBusinessPayment } from '../business/payments';
import { sendPaymentFailureEvent } from '../../../../libs/Utils';

/**
 * Creates a new user profile record.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    // Validate the incoming object
    validateSchema(req.body);
    const payUserInfo = new PaymentUserInformation(req.body);

    const billingRepo = new BillingRepository(client);
    const billing = await billingRepo.get(payUserInfo.policyId);
    billing.userInformation = payUserInfo;
    // We save the entity Id inside the billing record for the future
    billing.userInformation.entityId = Tenant.tenantEntityId;
    // We set the paymentStatus to in process
    billing.billingStatus.paymentStatus = BillingStatus.PaymentStatus.PaymentInProcess;
    await billingRepo.save(billing);

    // Next we handle the payment received
    await handleNewBusinessPayment(payUserInfo.policyId, billing.paymentPlan.planType);

    res.sendStatus(201);
  } catch (ex) {
    console.error(ex);
    logError(console.log, ex, 'Unable to create payment');

    if (ex.code === 'ConditionalCheckFailedException') {
      res.status(409).json(new ErrorResult(ErrorCodes.ResourceAlreadyExists, ex.message));
    } else if (ex instanceof ErrorResult) {
      res.status(400).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else {
      res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex.message));
    }

    await sendPaymentFailureEvent(req.body.policyId, req.body.cognitoUserId, Tenant.tenantEntityId);
  }
};
