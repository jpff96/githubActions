import { ScheduledEvent, ScheduledHandler } from 'aws-lambda';
import { ProductAPI } from '../../../../libs/API/ProductAPI';
import { PaymentSource } from '../../../../libs/constLib';
import { logError, logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { client } from '../../../../libs/dynamodb';
import { PaymentWithPaymentMethodRequest } from '../../../bill2pay/models/PayWithPaymentMethodTokenRequest';
import { makePaymentWithToken } from '../../../bill2pay/payWithMethodToken';
import { BillingRepository } from '../BillingRepository';
import { BillingStatus } from '../models/BillingStatus';
import { PaymentPlan } from '../models/PaymentPlan';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import { nextInstallmentAmountDue } from '../business/installment';
import { Lock } from '../models/Lock';
import { Billing } from '../models/Billing';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { Bill2PayResultCodes } from '../../../../libs/enumLib';

/**
 * Main entry point for the invoice job.
 * @param event Event data.
 */
export const main: ScheduledHandler = async (event: ScheduledEvent): Promise<void> => {
  try {
    const repository = new BillingRepository(client);

    const products = await ProductAPI.getProductList();
    const billingRepo = new BillingRepository(client);

    for (const productKey of products) {
      try {
        let lastEvaluatedKey;

        do {
          // We get all policies due today.
          const policyList = await repository.getByDueDate(productKey, new Date(), 10, lastEvaluatedKey);
          lastEvaluatedKey = policyList.lastEvaluatedKey;

          for (const policyId of policyList.policies) {
            await triggerInstallment(policyId, repository);
          }
        } while (lastEvaluatedKey);
      } catch (ex) {
        // Log error, but go on to the next product
        console.error(ex);
      }
    }
  } catch (ex) {
    console.error(ex);

    throw ex;
  }
};

/**
 * Generate a new paymentInformation object for bill2Pay token payment.
 * @param billing
 */
export const generateBillingInformationObject = async (
  billing: Billing,
  paymentMethodToken?: string
): Promise<PaymentWithPaymentMethodRequest> => {
  let result = new PaymentWithPaymentMethodRequest();
  result.allowCreditCard = true;
  result.allowECheck = true;
  result.customerId = billing.userInformation.customerId;
  result.productName = billing.productKey;
  result.policyNumber = billing.policyNumber;
  result.redirectHref = '';
  result.accountNumber = billing.accountNumber;
  result.paymentSource = PaymentSource.PORTAL;
  result.paymentMethodToken = paymentMethodToken ?? billing.paymentMethod.defaultPaymentMethod.token;
  result.policyId = billing.pk;
  // For now leave this hardcoded since the cronjob is for elevenpay installments
  result.paymentPlan = PaymentPlan.PaymentPlanType.ElevenPay;
  // The amount to be paid is installment + installment fee
  const amountDue = await nextInstallmentAmountDue(billing);
  result.amount = amountDue.amountToBePaid;
  result.isFirstPayment = amountDue.isFirstPayment;

  return result;
};

/**
 * Trigger installments payment for due invoices.
 * @param policyId
 * @param repository
 * @param retryFailures
 */
export const triggerInstallment = async (
  policyId: string,
  repository: BillingRepository,
  paymentMethodToken?: string
) => {
  let lock: Lock;
  let paymentCompletedStatus = BillingStatus.PaymentStatus.PaymentCompleted;
  let lockStatus = BillingStatus.StatusType.InProcess;
  let result = null;
  try {
    lock = await repository.lock(policyId, lockStatus);

    if (lock) {
      // Process the payment only if the payment hasn't been completed yet
      let billing = await repository.get(policyId);

      const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');
      logTrace(loggerInfo, '🚀', 'installment-billing-before-updating', billing);

      logTrace(loggerInfo, '🚀', 'installment-lockStatus-after-locking', billing.billingStatus.lockStatus);
      if (
        billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay &&
        billing.billingStatus.paymentStatus !== paymentCompletedStatus
      ) {
        if (billing.paymentDetail.installmentsLeft !== 0) {
          const paymentInformation = await generateBillingInformationObject(billing, paymentMethodToken);
          // if theres anything to pay for then we try to process the payment
          if (paymentInformation.amount > 0) {
            result = await makePaymentWithToken(billing.userInformation.entityId, paymentInformation);

            if (result.status === Bill2PayResultCodes.OK) {
              await ActivityLogProducer.sendActivityLog(
                policyId,
                billing.agencyEntityId,
                'Installment payment processed succesfully.'
              );
            }

          }
        }
        lockStatus = BillingStatus.StatusType.None;
      }
    }

    return result;
  } catch (error) {
    logError(console.log, error, 'Unable to trigger installment payment');
  } finally {
    if (lock) {
      await repository.unlock(policyId, lockStatus);
    }
  }
};
