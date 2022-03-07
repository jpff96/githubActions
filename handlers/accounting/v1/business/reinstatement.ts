import { addDays, formatISO, isBefore, isToday, parseISO } from 'date-fns';
import { client } from '../../../../libs/dynamodb';
import { BalanceRepository } from '../BalanceRepository';
import { BalanceDue } from '../models/BalanceDue';
import { Billing } from '../models/Billing';
import { LineItem } from '../models/LineItem';
import { LineItems } from '../models/LineItems';
import { PaymentPlan } from '../models/PaymentPlan';
import { AccountingDocType, BalanceRecordType } from '../../../../libs/enumLib';
import * as math from 'mathjs';

/**
 * Gets the amount that the insured has to pay to reinstate the policy from the amount to be paid in the list of installments
 * @param billing the billing record of the policy
 * @param policyId the policyId.
 * @returns the amount to be paid
 */
export const getReinstatmentLineItems = async (policyId: string, billing: Billing) => {
  const balanceDueLineItems = new LineItems();
  const mainBalanceDue = await getReinstatementBalanceDue(policyId, billing.cancellationDate, BalanceRecordType.MainBalanceDue);
  const companionBalanceDue = await getReinstatementBalanceDue(policyId, billing.cancellationDate, BalanceRecordType.CompanionBalanceDue);
  // TODO: Remove this when product config is setup for Payments and start pulling writingCompany from there
  const lineItem = mainBalanceDue.lineItems.find((lineItem) => lineItem.account === LineItem.AccountType.Main);
  const writingCompany = lineItem?.writingCompany;

  if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.FullPay) {
    balanceDueLineItems.addLineItems(mainBalanceDue.lineItems);
    if (companionBalanceDue) {
      balanceDueLineItems.addLineItems(companionBalanceDue.lineItems);
    }
  } else if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay) {
    let isFirstUnpaidInstallment = false;
    for (let installment of billing.paymentDetail.listOfInstallments) {
      //TODO: overwrite installment list with new values.
      let isTodayDate = isToday(parseISO(installment.dueDate));
      let isBeforeDate = isBefore(parseISO(installment.dueDate), new Date());
      if (installment.paid === false && (isTodayDate || isBeforeDate)) {
        balanceDueLineItems.addLineItems(installment.lineItems);
        // TODO: Remove this and pull instalmentFee from balanceDue (needs to figure out how to ignore cancellation values)
        if (!isFirstUnpaidInstallment) {
          balanceDueLineItems.addLineItem(
            new LineItem({
              amount: installment.installmentFee,
              itemType: LineItem.ItemType.Fee,
              account: LineItem.AccountType.InstallmentFee,
              writingCompany: writingCompany
            })
          );
          isFirstUnpaidInstallment = true;
        }
      }
    }
  }
  return balanceDueLineItems;
};

/**
 * Gets the transactions by date that correspond to the balance due passed
 * @param policyId the policy id.
 * @param date start date to be compared with today.
 * @param balanceDueType The balance record type that its supposed to return.
 * @returns the amount to be paid in line items
 */
export const getReinstatementBalanceDue = async (
  policyId: string,
  date: string,
  balanceDueType: BalanceRecordType
): Promise<BalanceDue> => {
  const cancellationDate = formatISO(parseISO(date));
  const todayEOD = formatISO(addDays(new Date(), 1));

  const balanceRepository = new BalanceRepository(client);
  //We had to add one day to consider the transactions made on the same day.
  const transactions = await balanceRepository.getTransactionsByDate(
    policyId,
    AccountingDocType.Charge,
    cancellationDate,
    todayEOD
  );
  let balanceDue;

  if (transactions.length > 0) {
    switch (balanceDueType) {
      case BalanceRecordType.CompanionBalanceDue:
        for (let transaction of transactions) {
          if (transaction.balanceDue.balanceType === BalanceRecordType.CompanionCancellation) {
            balanceDue = new BalanceDue(transaction.balanceDue);
            balanceDue.balanceType = BalanceRecordType.Reinstatement;
            balanceDue.description = 'Reinstatement Companion Balance Due';
            // We need to negate the lineitems since this was a negative entry
            balanceDue.negateLineItems();
          }
        }
        break;
      case BalanceRecordType.MainBalanceDue:
        for (let transaction of transactions) {
          if (transaction.balanceDue.balanceType === BalanceRecordType.Cancellation) {
            balanceDue = new BalanceDue(transaction.balanceDue);
            balanceDue.balanceType = BalanceRecordType.Reinstatement;
            balanceDue.description = 'Reinstatement Main Balance Due';
            balanceDue.negateLineItems();
          }
        }
        break;

      default:
        break;
    }
  }

  return balanceDue;
};