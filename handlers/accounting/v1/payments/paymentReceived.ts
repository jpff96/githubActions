import { ErrorResult, logError } from '@eclipsetechnology/eclipse-api-helpers';
import Tenant from '../../../../libs/Tenant';
import { Request, Response } from 'express';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { handlePaymentWithReinstate } from '../business/payments';
import { Bill2Pay } from '../../../bill2pay/bill2Pay';
import { BillingRepository } from '../BillingRepository';
import { client } from '../../../../libs/dynamodb';
import { Payment } from '../models/Payment';
import { Bill2PayResultCodes, providers } from '../../../../libs/enumLib';
import { getPaymentType } from '../../../../libs/Utils';

/**
 * Processes a record of a new payment.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const processPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const { policyId } = req.body;
    const billingRepo = new BillingRepository(client);
    const billing = await billingRepo.get(policyId);
    const bill2pay = new Bill2Pay();

    if (billing) {
      const transactionToken = billing.paymentDetail.transactionToken;
      const paymentStatus = await bill2pay.getPaymentStatus(transactionToken, billing.ownerEntityId);

      if (paymentStatus.resultCode === Bill2PayResultCodes.OK) {
        const payment = new Payment();
        payment.provider = providers.Bill2Pay;
        payment.subtotalPlusProviderFee = paymentStatus.amount + paymentStatus.fee;
        payment.paymentType = getPaymentType(paymentStatus.paymentType);
        payment.customerId = billing.userInformation?.customerId;
        payment.accountLast4 = paymentStatus.paymentMethod;
        payment.cognitoUserId = billing.userInformation?.email;
        payment.processedDateTime = paymentStatus.transactionDateTime;
        payment.confirmationNumber = paymentStatus.confirmationNumber;
        payment.providerReference = paymentStatus.confirmationNumber;
        payment.companionNumber = billing.companionNumber;
        payment.productKey = billing.productKey;
        payment.policyNumber = billing.policyNumber;
        payment.authCode = paymentStatus.authCode;
        payment.providerFee = paymentStatus.fee;
        payment.description = 'Premium Received';

        // We handle the payment received
        await handlePaymentWithReinstate(policyId, paymentStatus.amount, payment);
      } else {
        throw new Error("The provider wasn't able to correctly process the payment");
      }

      res.sendStatus(201);
    } else {
      throw new Error(`No Billing record found using policyId:${policyId}`);
    }
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
  }
};
