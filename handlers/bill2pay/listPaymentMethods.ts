import { ErrorResult, lookupTenantId } from '@eclipsetechnology/eclipse-api-helpers';
import { Bill2Pay } from './bill2Pay';
import { ErrorCodes } from '../../libs/errors/ErrorCodes';
import Tenant from '../../libs/Tenant';

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
  let { id: customerId } = req.params;

  try {
    // Load incoming data from req body
    Tenant.init(req);
    const tenantId = Tenant.tenantEntityId;


    const bill2Pay = new Bill2Pay();
    const paymentmethodResult = await bill2Pay.listPaymentMethods(customerId, tenantId);

    switch (paymentmethodResult.resultCode) {
      case 200:
        res.status(200).json(paymentmethodResult.listOfMethods);
        break;
      case 400:
        res.status(400).json(new ErrorResult<ErrorCodes>( ErrorCodes.InvalidData,
          'Bad Request – Invalid data'));
        break;
      case 401:
        // TODO Update ResponseHelper to include unauthorized response
        res.status(401).json(new ErrorResult<ErrorCodes>(ErrorCodes.MissingSecurityHeader,
          'Unauthorized – Invalid or missing security key header'));
        break;
      case 404:
        // TODO Update ResponseHelper to include Conflict response
        res.status(404).json(new ErrorResult<ErrorCodes>(ErrorCodes.PaymentMethodNotFound,
          'No payment methods found '));
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
