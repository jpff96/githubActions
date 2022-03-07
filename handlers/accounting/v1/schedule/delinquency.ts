import { ScheduledEvent, ScheduledHandler } from 'aws-lambda';
import { addDays, isBefore, isToday, parseISO } from 'date-fns';
import { ProductAPI } from '../../../../libs/API/ProductAPI';
import { client } from '../../../../libs/dynamodb';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { BillingRepository } from '../BillingRepository';
import { BillingStatus } from '../models/BillingStatus';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { Lock } from '../models/Lock';
import { BalanceRepository } from '../BalanceRepository';
import { AccountingDocType } from '../../../../libs/enumLib';
import { PaymentPlan } from '../models/PaymentPlan';
import { BillingRecords } from 'aws-sdk/clients/route53domains';
import { Billing } from '../models/Billing';

/**
 * Main entry point for the dilenquency job.
 * @param event Event data.
 */
export const main: ScheduledHandler = async (event: ScheduledEvent): Promise<void> => {
  try {
    const repository = new BillingRepository(client);

    // TODO - getProductList() should not take parameters to return all products
    const products = await ProductAPI.getProductList();

    for (const productKey of products) {
      try {
        const [productMain, ProductAccounting] = await ProductAPI.getConfiguration(productKey);
        // const days = ProductAccounting.delinquencyDaysBeforeCancelDate...
        const days = 15;
        const cancelDate = addDays(new Date(), days);
        let lastEvaluatedKey;

        do {
          const policyList = await repository.getByCancelDate(productKey, cancelDate, 10, lastEvaluatedKey);
          lastEvaluatedKey = policyList.lastEvaluatedKey;

          for (const policyId of policyList.policies) {
            await handleDelinquency(policyId, repository);
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
 * Handle the delinquency process for the policy.
 * @param policyId The policy id.
 */
const handleDelinquency = async (policyId: string, repository: BillingRepository) => {
  let lock: Lock;
  let lockStatus = BillingStatus.StatusType.InProcess;
  let status = BillingStatus.DelinquencyStatus.DelinquencyProcessNotStarted;
  let detail = {};

  try {
    lock = await repository.lock(policyId, lockStatus);

    if (lock) {
      // Get billing info from billing table
      const billing = await repository.get(policyId);
      const delinquencyStatus = billing.billingStatus.delinquencyStatus;
      const cancelDate = parseISO(billing.cancelDate);
      if (isToday(cancelDate) || isBefore(cancelDate, new Date())) {
        if (delinquencyStatus !== BillingStatus.DelinquencyStatus.DelinquencyCompleted) {
          detail = ServiceEventProducer.createDelinquencyEventDetail(
            billing.cancelDate,
            policyId,
            billing.paymentPlan.responsibleParty,
            billing.userInformation.entityId
          );
          await ServiceEventProducer.sendServiceEvent(detail, ServiceEventProducer.DetailType.DelinquentPolicyCancel);
          status = BillingStatus.DelinquencyStatus.DelinquencyCompleted;
          await repository.setDelinquencyStatus(policyId, status);
          await ActivityLogProducer.sendActivityLog(
            // TODO - Investigue business rules to generate proper activity log
            policyId,
            billing.agencyEntityId,
            'Policy cancel process started.',
            {
              cancelDate: billing.cancelDate
            }
          );
        }
      } else {
        if (delinquencyStatus === status) {
          let cancelDate = billing.cancelDate;
          const hasPayment = await hasReceivedPayment(billing);
          // If the responsible party is Mortgagee and did not make any payment the cancelDate should be the same of effective date in order to
          // not ensure policy without any payment
          if (billing.paymentPlan.responsibleParty === PaymentPlan.ResponsibleParty.Mortgagee && !hasPayment) {
            cancelDate = billing.effectiveDate;
          }

          detail = ServiceEventProducer.createDelinquencyEventDetail(
            cancelDate,
            policyId,
            billing.paymentPlan.responsibleParty,
            billing.userInformation.entityId
          );
          status = BillingStatus.DelinquencyStatus.DelinquencyProcessStarted;

          await ServiceEventProducer.sendServiceEvent(detail, ServiceEventProducer.DetailType.DelinquentPaymentNotice);
          await repository.setDelinquencyStatus(policyId, status);
          // Create activity log entry
          await ActivityLogProducer.sendActivityLog(policyId, billing.agencyEntityId, 'Policy will be canceled on: {{cancelDate}}', {
            cancelDate: billing.cancelDate
          });
        }
      }
      lockStatus = BillingStatus.StatusType.None;
    }
  } catch (ex) {
    console.error(ex);
    lockStatus = BillingStatus.StatusType.Error;
  } finally {
    if (lock) {
      await repository.unlock(policyId, lockStatus);
    }
  }
};

/**
 * Return true if the policy has at least one payment.
 * @param policyId The policy id.
 * @param effectiveDate Billing effectiveDate.
 */
const hasReceivedPayment = async (billing: Billing) => {
  const balanceRepository = new BalanceRepository(client);
  const paymentList = await balanceRepository.getTransactions(billing.pk, billing.effectiveDate, AccountingDocType.Payment);
  let hasPayment = false;
  for (const payment of paymentList) {  
    if (payment?.payment?.subtotal < 0) {
      hasPayment = true;
      break;
    }
  }
  return hasPayment;
};
