import { ErrorResult, lookupTenantId } from '@eclipsetechnology/eclipse-api-helpers';
import { PaymentWithPaymentMethodRequest } from './models/PayWithPaymentMethodTokenRequest';
import { PaymentWithTokenResponseModel } from './models/PaymentWithTokenResponseModel';
import { Bill2Pay } from './bill2Pay';
import { Configuration } from '../../libs/constLib';
import { ActivityLogProducer } from '../../libs/ActivityLogProducer';
import { EntityAPI } from '../../libs/API/EntityAPI';
import { ErrorCodes } from '../../libs/errors/ErrorCodes';
import { BillingRepository } from '../accounting/v1/BillingRepository';
import { client } from '../../libs/dynamodb';
import { Invoice } from '../accounting/v1/models/Invoice';
import { ServiceEventProducer } from '../../libs/ServiceEventProducer';
import { PaymentInformation } from '../accounting/v1/models/PaymentInformation';
import { processPaymentThroughInvoice } from '../accounting/v1/business/payments';
import { handleElevenPayPayment } from '../accounting/v1/business/elevenPay';
import { BillingStatus } from '../accounting/v1/models/BillingStatus';
import { sendPaymentFailureEvent } from '../../libs/Utils';

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

  try {
    // Load incoming data from event body
    const tenantId = lookupTenantId(req);
    const initializePayWithTokenRequest = new PaymentWithPaymentMethodRequest(req.body);
    const { status, data } = await makePaymentWithToken(tenantId, initializePayWithTokenRequest);
    res.status(status).json(data);
  } catch (ex) {
    console.error(ex);
    res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex));
  }
};

export const makePaymentWithToken = async (
  tenantId: string,
  initializePayWithTokenRequest: PaymentWithPaymentMethodRequest,
  invoice: Invoice = null
): Promise<any> => {
  const result = {
    data: null,
    status: 500
  };

  // Lookup the configuration information to pass to the provider
  const { settings } = await EntityAPI.getApiConfig(tenantId, Configuration.API_SIG);

  // pay with token
  const payWithToken = new PaymentWithTokenResponseModel();

  const { policyId, policyNumber } = initializePayWithTokenRequest;

  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);

  // pay with token
  const bill2Pay = new Bill2Pay();
  await bill2Pay.payWithPaymentMethodToken(initializePayWithTokenRequest, settings, payWithToken);

  const resultVerification = bill2Pay.paymentWithTokenResultVerification(payWithToken);
  if (resultVerification === 200) {
    // Create activity log entry pay with token
    await ActivityLogProducer.sendActivityLog(
      policyId,
      billing.agencyEntityId,
      'Processed payment of ${{amount}} for policy {{policyNumber}} using a previosuly saved payment method. Confirmation Number: {{confirmationNumber}}',
      {
        confirmationNumber: payWithToken.confirmationNumber,
        policyNumber: policyNumber,
        amount: payWithToken.amountPaid
      }
    );

    const paymentInformation = {
      amount: payWithToken.amountPaid,
      paymentMethod: payWithToken.paymentMethod,
      transactionDateTime: payWithToken.transactionDateTime,
      confirmationNumber: payWithToken.confirmationNumber,
      paymentType: payWithToken.paymentType,
      fee: payWithToken.convenienceFeeCharged,
      authCode: payWithToken.creditCardAuthCode
    };

    // In the future we need to change how we create payments using just invoices
    if (invoice) {
      await processPaymentThroughInvoice(paymentInformation, policyId, invoice);
    } else {
      await handleElevenPayPayment(
        policyId,
        new PaymentInformation(paymentInformation),
        initializePayWithTokenRequest.isFirstPayment
      );
    }
  } else {
    await ActivityLogProducer.sendActivityLog(
      policyId,
      billing.agencyEntityId,
      'Payment process using saved payment method failed. Message: {{message}}',
      {
        message: payWithToken.resultMessage
      }
    );
    await sendPaymentFailureEvent(policyId, billing.userInformation.email, tenantId);
  }
  result.status = resultVerification;
  result.data = payWithToken;

  return result;
};
