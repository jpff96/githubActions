import { ErrorResult, lookupTenantId } from '@eclipsetechnology/eclipse-api-helpers';
import { ActivityLogProducer } from '../../libs/ActivityLogProducer';
import { EntityAPI } from '../../libs/API/EntityAPI';
import { Configuration } from '../../libs/constLib';
import { client } from '../../libs/dynamodb';
import { ErrorCodes } from '../../libs/errors/ErrorCodes';
import { getOpenInvoices } from '../../libs/Utils';
import { BillingRepository } from '../accounting/v1/BillingRepository';
import { Bill2Pay, isEcheckAllowed } from './bill2Pay';
import { InitializeRequest } from './models/InitializeRequest';
import { PaymentInformationResponse } from './models/PaymentInformationResponse';
import { validateSchema } from './validation/transactionTokenValidator';

/**
 * Entry point for to setup a transaction for Payment providers like Bill2Pay that need this
 * preliminary step.
 *
 * @param req      Event data.
 *
 * @return Response object containing metadata or error message.
 */
export const main = async (req, res) => {
  try {
    // Load incoming data from event body
    const tenantId = lookupTenantId(req);

    // Lookup the configuration information to pass to the provider
    const { settings } = await EntityAPI.getApiConfig(tenantId, Configuration.API_SIG);
    const initResult = new PaymentInformationResponse();

    const reqBody = req.body;
    validateSchema(reqBody);
    const initializeRequest = new InitializeRequest(reqBody);
    const { policyId, policyNumber } = initializeRequest;
    const billingRepo = new BillingRepository(client);
    const billing = await billingRepo.get(policyId);

    const openInvoices = await getOpenInvoices(policyId);
    let amountToPay = 0;

    if (openInvoices.length > 0) {
      // At this moment we have only one open invoice because is the first payment.
      amountToPay = openInvoices[0].amountDue;
    } else {
      throw new Error('No open invoices found');
    }

    initializeRequest.accountNumber = billing.policyNumber;
    initializeRequest.amount = amountToPay;
    initializeRequest.allowECheck = isEcheckAllowed(billing.effectiveDate);

    // Call out to the provider to make the payment
    const bill2Pay = new Bill2Pay();
    await bill2Pay.getPaymentTransactionToken(initializeRequest, settings, initResult);

    // Create activity log entry pay without token
    await ActivityLogProducer.sendActivityLog(
      policyId,
      billing.agencyEntityId,
      'Payment initialized for policy {{policyNumber}} using {{provider}} generated token {{transactionToken}}',
      {
        provider: initResult.provider,
        transactionToken: initResult.transactionToken,
        policyId,
        policyNumber
      }
    );

    switch (initResult.resultCode) {
      case 201:
        billing.userInformation.entityId = tenantId;
        billing.paymentDetail.transactionToken = initResult.transactionToken;
        await billingRepo.save(billing);

        res.status(201).json(initResult);

        break;
      case 200:
        //TODO: Response on wallet returns 200 and not 201
        res.status(200).json(initResult);
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
      case 409:
        // TODO Update ResponseHelper to include Conflict response
        res
          .status(409)
          .json(
            new ErrorResult(ErrorCodes.Validation, 'Conflict – Invalid data or options (IE: amount exceeds limits…)')
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
