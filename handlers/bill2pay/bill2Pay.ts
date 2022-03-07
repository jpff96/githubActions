import axios from 'axios';
import { PaymentAccountInfoRequest } from './models/PaymentAccountInfoRequest';
import { MethodTokenAccountInfoRequest } from './models/MethodTokenAccountInfoRequest';
import { PaymentProviderType, SdeTypes } from '../../libs/constLib';
import { PaymentPlan } from '../accounting/v1/models/PaymentPlan';
import { PaymentInformationResponse } from './models/PaymentInformationResponse';
import { PaymentMethodResponseListModel } from './models/PaymentMethodReponseListModel';
import { PaymentWithTokenResponseModel } from './models/PaymentWithTokenResponseModel';
import { PaymentStatusModel } from './models/PaymentStatusModel';
import { EntityAPI } from '../../libs/API/EntityAPI';
import { Configuration } from '../../libs/constLib';
import { productNames, b2pProductNames, TimeZoneType } from '../../libs/enumLib';
import { B2pInfoBody } from './models/B2pInfoBody';
import { WalletResponse } from './models/WalletResponse';
import { compareAsc, isValid, parseISO, subDays } from 'date-fns';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import { logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { B2PDeleteMethodResult } from './models/B2PDeleteMethodResult';
import { zonedTimeToUtc } from 'date-fns-tz';

export class Bill2Pay {
  /**
   * Bill2Pay provider payment method.
   *
   * @param reqBody The main body/info store for this request.
   * @param apiconfig Configuration based on Tenant from entity
   * @param result The result payload to be returned to the caller.
   *
   * @return None. This method acts upon the paymentInformationResult object.
   */
  getPaymentTransactionToken = async (reqBody: any, apiConfig: any, result: PaymentInformationResponse) => {
    const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');

    result.provider = PaymentProviderType.BILL2PAY;

    let b2pData = new B2pInfoBody(reqBody);

    const b2pRootHref: string = apiConfig.bill2PaySolsticeUrl;
    const b2pSecurityToken: string = apiConfig.bill2PayApiKey;
    const b2pAccountNumber: string = b2pData.accountNumber;
    const b2pCustomerId: string = b2pData.customerId;
    let b2pProductName = generateProductName(b2pData.productName, b2pData.paymentPlan);

    // Secure Data Exchange (SDE) - Pass account information to the Bill2Pay system to get the TransactionToken
    const cartItems = [
      {
        ProductName: b2pProductName,
        AccountNumber1: b2pAccountNumber,
        AccountNumber2: b2pCustomerId.replace('-', ''),
        AccountNumber3: '',
        // PaymentPlan is validated before so at this point we either have FullPay or ElevenPay
        Amount: b2pData.amount
      }
    ];

    const accountInfoReqData = new PaymentAccountInfoRequest({
      sdeType: SdeTypes.PAYMENT,
      customerId: b2pCustomerId.replace('C', '').replace('-', ''),
      allowCreditCard: b2pData.allowCreditCard,
      paymentSource: b2pData.paymentSource,
      allowECheck: b2pData.allowECheck,
      redirectUrl: b2pData.redirectHref,
      cartItems
    });

    try {
      logTrace(loggerInfo, '🚀', 'bill2pay-generateTransationToken-accountInfoReqData', accountInfoReqData);

      const retVal = await axios({
        method: 'post',
        url: `${b2pRootHref}/SDE`,
        headers: {
          'Content-Type': 'application/json',
          SecurityToken: b2pSecurityToken
        },
        data: accountInfoReqData
      });
      logTrace(loggerInfo, '🚀', 'bill2pay-generateTransationToken-retVal', retVal.data);

      result.acceptCreditCards = retVal.data.AcceptCreditCards;
      result.acceptEChecks = retVal.data.AcceptEChecks;
      result.creditCardFee = retVal.data.CreditFee;
      result.eCheckFee = retVal.data.eCheckFee;
      result.providerResultCode = retVal.data.Result;
      result.transactionToken = retVal.data.TransactionToken;

      result.resultCode = retVal.status;
      result.resultMessage = retVal.statusText;
    } catch (error) {
      result.resultCode = error.response.status;
      result.resultMessage = error.response.statusText;
    }
  };

  /**
   * Bill2Pay provider wallet management method.
   *
   * @param reqBody The main body/info store for this request.
   * @param apiconfig Configuration based on Tenant from entity
   * @param result The result payload to be returned to the caller.
   *
   * @return None. This method acts upon the paymentInformationResult object.
   */
  getWalletTransactionToken = async (reqBody: any, apiConfig: any, result: WalletResponse) => {
    result.provider = PaymentProviderType.BILL2PAY;

    const { allowCreditCard, customerId, allowECheck, redirectHref } = reqBody;

    const b2pRootHref: string = apiConfig.bill2PaySolsticeUrl;
    const b2pSecurityToken: string = apiConfig.bill2PayApiKey;
    const b2pCustomerId: string = customerId;

    const accountInfoReqData = new PaymentAccountInfoRequest({
      sdeType: SdeTypes.WALLET,
      customerId: b2pCustomerId.replace('C', '').replace('-', ''),
      allowCreditCard,
      allowECheck,
      redirectUrl: redirectHref
    });

    try {
      const retVal = await axios({
        method: 'post',
        url: `${b2pRootHref}/SDE`,
        headers: {
          'Content-Type': 'application/json',
          SecurityToken: b2pSecurityToken
        },
        data: accountInfoReqData
      });

      result.acceptCreditCards = retVal.data.AcceptCreditCards;
      result.acceptEChecks = retVal.data.AcceptEChecks;
      result.transactionToken = retVal.data.TransactionToken;
      result.resultCode = retVal.status;
      result.resultMessage = retVal.statusText;
    } catch (error) {
      result.resultCode = error.response.status;
      result.resultMessage = error.response.statusText;
    }
  };

  /**
   * Bill2Pay list payment methods saved by the user.
   *
   * @param customerId Unique identifier for a logged in user.
   * @param apiconfig Configuration based on Tenant from entity
   * @param result The result payload to be returned to the caller.
   *
   * @return None. This method acts upon the paymentInformationResult object.
   */
  listPaymentMethods = async (customerId: string, tenantId: string): Promise<PaymentMethodResponseListModel> => {
    const result = new PaymentMethodResponseListModel();

    // Lookup the configuration information to pass to the provider
    const { settings: apiConfig } = await EntityAPI.getApiConfig(tenantId, Configuration.API_SIG);
    const b2pRootHref: string = apiConfig.bill2PaySolsticeUrl;
    const b2pSecurityToken: string = apiConfig.bill2PayApiKey;

    try {
      const retVal = await axios({
        method: 'get',
        url: `${b2pRootHref}/PaymentMethod/${customerId.replace('C', '').replace('-', '')}`,
        headers: {
          'Content-Type': 'application/json',
          SecurityToken: b2pSecurityToken
        }
      });

      result.listOfMethods = retVal.data;

      result.resultCode = retVal.status;
      result.resultMessage = retVal.statusText;
    } catch (error) {
      result.resultCode = error.response.status;
      result.resultMessage = error.response.statusText;
    }
    return result;
  };

  /**
   * Bill2Pay Pay with preivously saved payment method.
   *
   * @param reqBody The main body/info store for this request.
   * @param apiconfig Configuration based on Tenant from entity
   * @param result The result payload to be returned to the caller.
   *
   * @return None. This method acts upon the paymentInformationResult object.
   */
  payWithPaymentMethodToken = async (reqBody: any, apiConfig: any, result: PaymentWithTokenResponseModel) => {
    const {
      amount,
      allowCreditCard,
      customerId,
      allowECheck,
      redirectHref,
      accountNumber,
      productName,
      paymentSource,
      paymentMethodToken,
      paymentPlan
    } = reqBody;
    const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');

    const b2pRootHref: string = apiConfig.bill2PaySolsticeUrl;
    const b2pSecurityToken: string = apiConfig.bill2PayApiKey;
    const b2pAccountNumber: string = accountNumber;
    const b2pCustomerId: string = customerId;
    let b2pProductName = generateProductName(productName, paymentPlan);

    // Secure Data Exchange (SDE) - Pass account information to the Bill2Pay system to get the TransactionToken
    const cartItems = [
      {
        ProductName: b2pProductName,
        AccountNumber1: b2pAccountNumber,
        AccountNumber2: b2pCustomerId.replace('-', ''),
        AccountNumber3: '',
        Amount: amount
      }
    ];

    const accountInfoReqData = new MethodTokenAccountInfoRequest({
      customerId: b2pCustomerId.replace('C', '').replace('-', ''),
      allowCreditCard,
      allowECheck,
      redirectUrl: redirectHref,
      paymentMethodToken,
      paymentSource,
      cartItems
    });
    logTrace(loggerInfo, '🚀', 'bill2pay-payWithPaymentMethodToken-accountInfoReqData', accountInfoReqData);

    try {
      const retVal = await axios({
        method: 'post',
        url: `${b2pRootHref}/payment`,
        headers: {
          'Content-Type': 'application/json',
          SecurityToken: b2pSecurityToken
        },
        data: accountInfoReqData
      });
      logTrace(loggerInfo, '🚀', 'bill2pay-payWithPaymentMethodToken-retVal', retVal.data);

      // Convert transaction date time from Central to utc for storage.
      const timeZone = TimeZoneType.AmericaChicago;
      const utc = zonedTimeToUtc(retVal.data.TransactionDate, timeZone);
      let utcDateTime;

      if (isValid(utc) === true) {
        utcDateTime = utc.toISOString();
      } else {
        utcDateTime = new Date().toISOString();
      }

      result.resultCodeOfTransaction = retVal.data.Result;
      result.confirmationNumber = retVal.data.ConfirmationNumber;
      result.amountPaid = retVal.data.Amount;
      result.paymentType = retVal.data.PaymentType;
      result.creditCardAuthCode = retVal.data.AuthCode;
      result.convenienceFeeCharged = retVal.data.Fee;
      result.transactionDateTime = utcDateTime;
      result.paymentMethod = retVal.data.PaymentMethod;
      result.message = retVal.data.Message;
      result.resultCode = retVal.status;
      result.resultMessage = retVal.statusText;
    } catch (error) {
      result.resultCode = error.response.status;
      result.resultMessage = error.response.statusText;
    }
  };

  /**
   * Bill2Pay delete payment method.
   *
   * @param customerId Unique identifier for a logged in user.
   * @param apiconfig Configuration based on Tenant from entity
   * @param paymentMethodToken Payment Method Token corresponding to the method to be deleted.
   * @param result The result payload to be returned to the caller.
   *
   * @return None. This method acts upon the paymentInformationResult object.
   */
  deletePaymentMethod = async (customerId: string, tenantId: string, paymentMethodToken: string) => {
    const result = new B2PDeleteMethodResult();
    const { settings: apiConfig } = await EntityAPI.getApiConfig(tenantId, Configuration.API_SIG);

    const b2pRootHref: string = apiConfig.bill2PaySolsticeUrl;
    const b2pSecurityToken: string = apiConfig.bill2PayApiKey;

    try {
      const retVal = await axios({
        method: 'delete',
        url: `${b2pRootHref}/PaymentMethod/${customerId.replace('C', '').replace('-', '')}/${paymentMethodToken}`,
        headers: {
          'Content-Type': 'application/json',
          SecurityToken: b2pSecurityToken
        }
      });
      result.resultCode = retVal.status;
      result.resultMessage = retVal.statusText;
    } catch (error) {
      result.resultCode = error.response.status;
      result.resultMessage = error.response.statusText;
    }
    return result;
  };

  /**
   * Bill2Pay get previous payment status.
   *
   * @param transactionToken Token of the payment.
   * @param apiconfig Configuration based on Tenant from entity
   * @param result The result payload to be returned to the caller.
   *
   * @return None. This method acts upon the paymentInformationResult object.
   */
  getPaymentStatus = async (transactionToken: string, tenantId: string): Promise<PaymentStatusModel> => {
    const result = new PaymentStatusModel();
    const { settings: apiConfig } = await EntityAPI.getApiConfig(tenantId, Configuration.API_SIG);

    const b2pRootHref: string = apiConfig.bill2PaySolsticeUrl;
    const b2pSecurityToken: string = apiConfig.bill2PayApiKey;

    try {
      const retVal = await axios({
        method: 'get',
        url: `${b2pRootHref}/Payment/${transactionToken}`,
        headers: {
          'Content-Type': 'application/json',
          SecurityToken: b2pSecurityToken
        }
      });
      result.result = retVal.data.Result;
      result.confirmationNumber = retVal.data.ConfirmationNumber;
      result.amount = retVal.data.Amount;
      result.paymentType = retVal.data.PaymentType;
      result.paymentMethod = retVal.data.PaymentMethod;
      result.authCode = retVal.data.AuthCode;
      result.fee = retVal.data.Fee;
      result.transactionDateTime = retVal.data.TransactionDate;
      result.message = retVal.data.Message;
      result.resultCode = retVal.status;
      result.resultMessage = retVal.statusText;
    } catch (error) {
      result.resultCode = error.response.status;
      result.resultMessage = error.response.statusText;
    }

    return result;
  };

  /**
   * Bill2Pay result manager.
   *
   * @param paymentResult The result from processing a payment with a method token.
   *
   * @return None. This method acts upon the paymentInformationResult object.
   */
  paymentWithTokenResultVerification = (paymentResult: PaymentWithTokenResponseModel) => {
    let result;
    switch (paymentResult.resultCodeOfTransaction) {
      case 1000:
        result = 200;
        break;
      case 1002:
        result = new Error('Payment Failed');
        break;
      case 2008:
        result = new Error('Credit Cart Expired');
      case 4100:
        result = new Error('Payment Method not Found');
        break;
      case 6012:
        result = new Error('Neither credit card or eCheck is allowed');
        break;
      default:
        result = new Error('Error Occured');
        break;
    }
    return result;
  };
}

export const evenRound = (num, decimalPlaces) => {
  var d = decimalPlaces || 0;
  var m = Math.pow(10, d);
  var n = +(d ? num * m : num).toFixed(8); // Avoid rounding errors
  var i = Math.floor(n),
    f = n - i;
  var e = 1e-8; // Allow for rounding errors in f
  var r = f > 0.5 - e && f < 0.5 + e ? (i % 2 == 0 ? i : i + 1) : Math.round(n);
  return d ? r / m : r;
};

// TODO: This logic should be removed. Product-API should handle all payment related productNames and added to the product configurations | When removing this make sure to add paymentPlan Validation
const generateProductName = (productName, paymentPlan): string => {
  let b2pProductName: string;

  if (productName === productNames.OpenHouse) {
    if (paymentPlan === PaymentPlan.PaymentPlanType.ElevenPay) {
      b2pProductName = b2pProductNames.Openhouse + '-PP';
    } else if (paymentPlan === PaymentPlan.PaymentPlanType.FullPay) {
      b2pProductName = b2pProductNames.Openhouse + '-FP';
    } else {
      throw new Error('Wrong Payment Plan');
    }
  } else {
    throw new Error('Wrong product name');
  }
  return b2pProductName;
};

/**
 * Is Echeck Allowed result.
 *
 * @param effectiveDate The validation to use ECheck only if the effective Date is more than 6 days ahead.
 *
 * @return Boolean.
 */
export const isEcheckAllowed = (effectiveDate: string): boolean => {
  let allowEcheck = compareAsc(subDays(parseISO(effectiveDate), 6), new Date()) === 1 ? true : false;

  return allowEcheck;
};
