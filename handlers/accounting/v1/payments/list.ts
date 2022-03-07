import { ErrorResult, safeQueryParam } from '@eclipsetechnology/eclipse-api-helpers';
import Tenant from '../../../../libs/Tenant';
import { Request, Response } from 'express';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { client } from '../../../../libs/dynamodb';
import { BalanceRepository } from '../BalanceRepository';
import { AccountingDocType, BalanceRecordType } from '../../../../libs/enumLib';
import { BillingRepository } from '../BillingRepository';
import { Payment } from '../models/Payment';
import { evenRound } from '../../../bill2pay/bill2Pay';
import { IBalanceTransaction } from '../models/IBalanceTransaction';
import { LineItems } from '../models/LineItems';
import { BalanceTransaction } from '../models/BalanceTransaction';
import { Billing } from '../models/Billing';
import { O_RDONLY } from 'constants';
import { BalanceDue } from '../models/BalanceDue';

/**
 * Gets a list of users for the tenant.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    // This method can be called from API and UI
    if (!req.headers['x-api-key']) {
      // Load incoming data from event
      Tenant.init(req);
    }

    const policyId = decodeURIComponent(req.params.entity);
    let transactionType: AccountingDocType;
    let resultData: Array<IBalanceTransaction>;

    const billingRepo = new BillingRepository(client);
    let billing = await billingRepo.get(policyId);

    const termEffectiveDate = safeQueryParam(req.query, 'termEffectiveDate');
    const transactionTypeReq = safeQueryParam(req.query, 'transactionType');

    switch (transactionTypeReq) {
      case AccountingDocType.Charge:
        transactionType = AccountingDocType.Charge;
        break;
      case AccountingDocType.Payment:
        transactionType = AccountingDocType.Payment;
        break;
      case AccountingDocType.Totals:
        transactionType = AccountingDocType.Totals;
        break;
    }

    const repository = new BalanceRepository(client);
    resultData = await repository.getTransactions(policyId, termEffectiveDate, transactionType);

    if (transactionType || termEffectiveDate) {
      const totals = await repository.getTotals(policyId, termEffectiveDate);

      if (totals) {
        resultData.push(totals);
      }
    }

    if (resultData && billing) {
      //TODO: get policyStatus from FE call from policyAPI or dueDate as null
      let totalPremium = 0;
      let paidToDate = 0;
      let outstandingBalance = 0;
      let totalPremiumLineItems = new LineItems();

      for (let transaction of resultData) {
        if (transaction.balanceDue) {
          totalPremiumLineItems.addLineItems(transaction.balanceDue.lineItems);
        }

        if (transaction.payment) {
          //This check about existing transaction.payment.status is because older payments doesn't have any status
          if (
            transaction.payment.status !== Payment.PaymentStatus.Pending &&
            transaction.payment.status !== Payment.PaymentStatus.Approved &&
            transaction.payment.status !== Payment.PaymentStatus.Voided
          ) {
            paidToDate -= transaction.payment.subtotal;
          }

          //When Policy is canceled outstandingBalance is the amount pending to be returned to the customer.
          if (!billing.dueDate && transaction.payment.status === Payment.PaymentStatus.Pending) {
            outstandingBalance -= transaction.payment.subtotal;
          }
        }
      }

      // If policy is cancelled remove cancel record to show total before cancel
      if (!billing.dueDate) {
        const transactions = resultData as Array<BalanceTransaction>;

        // Find the last ocurrance of cancel main record
        const cancelled = transactions.filter(
          (trans) => trans.balanceDue?.balanceType === BalanceRecordType.Cancellation
        );

        if (cancelled.length > 0) {
          const lastCancelRecord = cancelled.reduce((prev, current) => {
            return prev.version >= current.version ? prev : current;
          });

          // Look for companion cancellation record with same version
          const companionRecord = transactions.find(
            (x) =>
              x.version === lastCancelRecord.version &&
              x.balanceDue?.balanceType === BalanceRecordType.CompanionCancellation
          );

          // Subtract from totalPremiumLineItems
          totalPremiumLineItems.subtractLineItems(lastCancelRecord.balanceDue.lineItems);

          if (companionRecord) {
            totalPremiumLineItems.subtractLineItems(companionRecord.balanceDue.lineItems);
          }
        }
      }

      totalPremium = totalPremiumLineItems.subtotal;

      // When Policy is not canceled outstandingBalance is the totalPremium less the paidToDate
      if (billing.dueDate) {
        outstandingBalance = evenRound(totalPremium - paidToDate, 2);
      }

      const result = {
        balanceRecords: mapSort(resultData),
        paymentDetails: {
          nextDueDate: billing.dueDate,
          cancellationForNonPayment: billing.cancelDate,
          totalPremium,
          paidToDate,
          outstandingBalance
        },
        paymentBreakdown: totalPremiumLineItems.lineItems
      };

      res.status(200).json(result);
    } else {
      res.status(404).json(new ErrorResult<ErrorCodes>(ErrorCodes.NotFound, 'No transactions found.'));
    }
  } catch (ex) {
    console.error(ex);

    if (ex instanceof ErrorResult) {
      res.status(400).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else {
      res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex.message));
    }
  }
};

/**
 * Sorts the transactions by date string.
 * Assumes data looks like below examples with 0 or 1 underscore only.
 * CHRG_2020-03-26T14:41:16.479Z
 * PMNT_2020-03-17T18:46:10.437Z
 * TOTALS
 * @param {array} list Array of elements to sort.
 */
const mapSort = (list) => {
  // temporary array holds objects with position and sort-value
  const mapped = list.map((ele, i) => {
    let position = ele.typeDate.indexOf('_');

    if (position === -1) {
      position = 0;
    }

    return { index: i, value: ele.typeDate.slice(position) };
  });

  // sorting the mapped array containing the reduced values
  mapped.sort((a, b) => {
    if (a.value < b.value) {
      return 1;
    }

    if (a.value > b.value) {
      return -1;
    }

    return 0;
  });

  // container for the resulting order
  var result = mapped.map((ele) => {
    return list[ele.index];
  });

  return result;
};
