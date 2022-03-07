import { ErrorResult, lookupTenantId  } from '@eclipsetechnology/eclipse-api-helpers';
import { Bill2Pay } from './bill2Pay';
import { logError } from '../../libs/logLib';
import { ErrorCodes } from '../../libs/errors/ErrorCodes';

/**
 * Fetch Payment status using it's transaction token.
 * @param req      Event data.
 *
 * @return Response object containing metadata or error message.
 */
export const main = async (req, res) => {

  // Declare global variables
  const {id: transactionToken } = req.params;

  try {
    // Load incoming data from req body
    const tenantId = lookupTenantId(req);

    // Lookup the configuration information to pass to the provider
    const bill2Pay = new Bill2Pay();
    const paymentStatus = await bill2Pay.getPaymentStatus(transactionToken, tenantId)

    res.status(201).json(paymentStatus);
  } catch (ex) {
    logError(console.log, ex, 'initialize_ERROR');
    res.status(400).json(new ErrorResult<ErrorCodes>( ErrorCodes.InvalidData,
      ex.message));
  }
};
