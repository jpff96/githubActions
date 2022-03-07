import { bodyToJSON, lookupTenantId, ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Bill2Pay } from './bill2Pay';
import { Configuration } from '../../libs/constLib';
import { ActivityLogProducer } from '../../libs/ActivityLogProducer';
import { EntityAPI } from '../../libs/API/EntityAPI';
import { ErrorCodes } from '../../libs/errors/ErrorCodes';
import { B2PDeleteMethodResult } from './models/B2PDeleteMethodResult';
import { BillingRepository } from '../accounting/v1/BillingRepository';
import { client } from '../../libs/dynamodb';

/**
 * Entry point for to setup a transaction for Payment providers like Bill2Pay that need this
 * preliminary step.
 *
 * @param req      Event data.
 *
 * @return Response object containing metadata or error message.
 */
export const main = async (req, res) => {
  // Declare global variables
  let response = null;

  try {
    // Load incoming data from event body
    const tenantId = lookupTenantId(req);

    const reqBody = req.body;

    const bill2Pay = new Bill2Pay();
    const result = await bill2Pay.deletePaymentMethod(reqBody.customerId, tenantId, reqBody.paymentMethodToken);

    const policyId = reqBody.policyId;

    const billingRepo = new BillingRepository(client);
    const billing = await billingRepo.get(policyId);

    if (!billing) {
      throw new Error(`No Billing record found using policyId:${policyId}`);
    }

    const agencyEntityId = billing.agencyEntityId;

    // Create activity log entry
    await ActivityLogProducer.sendActivityLog(
      policyId,
      agencyEntityId,
      'Payment method deleted. Payment Method reference: {{paymentMethodToken}}',
      {
        customerId: reqBody.customerId,
        paymentMethodToken: reqBody.paymentMethodToken
      }
    );
    switch (result.resultCode) {
      case 204:
        // TODO Update ResponseHelper to include No Content response
        res.status(204).json(result.resultCode);
        break;
      case 400:
        res.status(400).json(new ErrorResult<ErrorCodes>(ErrorCodes.InvalidData,
          'Bad Request – Invalid data'));
        break;
      case 401:
        res.status(401).json(new ErrorResult<ErrorCodes>(ErrorCodes.MissingSecurityHeader,
          'Unauthorized – Invalid or missing security key header'));
        break;
      case 404:
        res.status(404).json(new ErrorResult<ErrorCodes>(ErrorCodes.PaymentMethodNotFound,
          'No payment methods found '));
        break;
      default:
        res.status(500).json(new ErrorResult(ErrorCodes.Unknown, 'Unexpected error'));
        break;
    }
  } catch (ex) {
    res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex.message));
  }
};
