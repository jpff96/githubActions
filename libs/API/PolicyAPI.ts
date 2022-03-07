const axios = require('axios');

export class PolicyAPI {
  /**
   * Call the Policy Accounting API to create a payment record
   *
   * @param rootHref
   * @param origin
   * @param Authorization
   * @param tenantId
   * @param principalId
   * @param paymentResult
   * @param providerReference
   */
  static createPaymentRecord = async (
    rootHref: string,
    origin: string,
    Authorization: string,
    tenantId: string,
    principalId: string,
    paymentResult: any,
    providerReference: string
  ) => {
    const data = {
      paymentResult: {
        provider: paymentResult.provider,
        accountLast4: paymentResult.response.accountNumberLast4,
        accountType: paymentResult.response.accountType,
        amount: paymentResult.response.amount,
        description: paymentResult.response.description,
        paymentType: paymentResult.response.paymentType,
        policyId: paymentResult.response.policyId,
        policyPaymentId: paymentResult.response.instanceKey,
        nameOnAccount: paymentResult.response.nameOnAccount
      },
      providerReference,
      cognitoUserId: principalId
    };

    const paymentCreationResponse = await axios({
      method: 'post',
      url: `${rootHref}/policy/accounting/v2/payment/${tenantId}`,
      headers: {
        origin,
        'content-type': 'application/json',
        Authorization
      },
      data: JSON.stringify(data)
    });

    // Return reference key to identify the record in Dymamo
    const {
      data: {
        message: { policyId, typeDate }
      }
    } = paymentCreationResponse;

    return { policyId, typeDate };
  };

  /**
   * Create the balance record for this refund
   *
   * @param rootHref
   * @param origin
   * @param Authorization
   * @param tenantId
   * @param principalId
   * @param refundResult
   * @param providerReference
   */
  static createRefundRecord = async (
    rootHref: string,
    origin: string,
    Authorization: string,
    tenantId: string,
    principalId: string,
    refundResult: any,
    providerReference: string
  ) => {
    const data = {
      paymentResult: {
        provider: refundResult.provider,
        accountLast4: refundResult.response.accountNumberLast4,
        accountType: refundResult.response.accountType,
        amount: refundResult.response.amount,
        description: refundResult.response.description,
        paymentType: refundResult.response.paymentType,
        policyId: refundResult.response.policyId,
        instanceKey: refundResult.response.instanceKey
      },
      providerReference,
      cognitoUserId: principalId
    };

    const request = await axios({
      method: 'post',
      url: `${rootHref}/policy/accounting/v2/refund/${tenantId}`,
      headers: {
        origin,
        'content-type': 'application/json',
        Authorization
      },
      data: JSON.stringify(data)
    });

    // Return reference key
    return { policyId: request.data.message.policyId, typeDate: request.data.message.typeDate };
  };

  /**
   * Call the Policy Accounting API to get the payment record
   *
   * @param rootHref
   * @param origin
   * @param Authorization
   * @param paymentKey
   */
  static getPayment = async (
    rootHref: string,
    origin: string,
    Authorization: string,
    paymentKey: any
  ) => {
    const { policyId, typeDate } = paymentKey;

    const request = await axios({
      method: 'get',
      url: `${rootHref}/policy/accounting/v2/${policyId}?typeDate=${typeDate}`,
      headers: {
        origin,
        'content-type': 'application/json',
        Authorization
      }
    });

    return request.data.message;
  };

  /**
   * Call the Policy API to get the policy record
   *
   * @param rootHref
   * @param origin
   * @param Authorization
   * @param policyId
   */
  static getPolicy = async (
    rootHref: string,
    origin: string,
    Authorization: string,
    policyId: string
  ) => {
    const request = await axios({
      method: 'get',
      url: `${rootHref}/policy/v2/${policyId}`,
      headers: {
        origin,
        'content-type': 'application/json',
        Authorization
      }
    });

    return request.data.message;
  };
}
