import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { formatISO } from 'date-fns';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { Reasons } from '../../../../libs/enumLib';
import { ArgumentError } from '../../../../libs/errors/ArgumentError';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';
import { BillingRepository } from '../../../accounting/v1/BillingRepository';
import { Invoice } from '../../../accounting/v1/models/Invoice';
import { LockboxRepository } from '../LockboxRepository';
import { Batch } from '../models/Batch';
import { CheckTransaction } from '../models/CheckTransaction';
import { RefundTransaction } from '../models/RefundTransaction';
import { BatchHelper } from '../schedule/BatchHelper';
import { validateAction } from '../validation/actionValidation';

/**
 * Request an action to change the status for a transaction record.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const requestAction = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const batchId = decodeURIComponent(req.params.id);
    const transId = decodeURIComponent(req.params.transId);
    validateAction(req.body);
    const { action, policyNumber, amount } = req.body;

    const repository = new LockboxRepository(client);
    const batch = await repository.getBatch(batchId);

    if (batch) {
      if (batch.status === Batch.Status.Released) {
        throw new ErrorResult<ErrorCodes>(ErrorCodes.InvalidData, 'A released batch may not be modified.');
      }

      const transaction = batch.transactions.find((x) => x.transactionId === transId);

      if (transaction) {
        switch (action) {
          case CheckTransaction.Action.Approve:
            await BatchHelper.checkTransaction(transaction);

            if (
              transaction.status === CheckTransaction.Status.Matched ||
              transaction.errors?.includes(CheckTransaction.MatchErrors.PolicyId) === false
            ) {
              transaction.status = CheckTransaction.Status.Approved;
            } else {
              throw new ErrorResult(ErrorCodes.NotBalanced, 'Transaction must be balanced before approving.');
            }
            break;

          case CheckTransaction.Action.Reset:
            // Sets the transaction back to Matched or Suspense even if already Approved.
            await BatchHelper.checkTransaction(transaction, true);
            break;

          case CheckTransaction.Action.Update:
            if (policyNumber) {
              transaction.policyId = LockboxRepository.buildPolicyId(batch.entityId, policyNumber);
              transaction.policyNumber = policyNumber;

              // Get invoice number and update based on the new policy number
              const billingRepository = new BillingRepository(client);
              const invoices = await billingRepository.getInvoicesByStatus(
                transaction.policyId,
                Invoice.PaymentStatus.Pending
              );

              if (invoices) {
                transaction.invoiceNumber = invoices.shift()?.invoiceNumber;
              }
            }
            // We don't want the UI to change amount right now
            // if (amount) {
            //   transaction.amount = Number(amount);
            // }

            await BatchHelper.checkTransaction(transaction);
            break;

          case CheckTransaction.Action.Refund:

            const refund = new RefundTransaction(req.body);

            transaction.status = CheckTransaction.Status.RefundApproved;
            transaction.recipients = refund.recipients;
            transaction.deliveryMethod = refund.deliveryMethod;
            transaction.costType = refund.costType;
            transaction.referenceNumber = batchId;
            transaction.reason = Reasons.RefundedCheck;
            await repository.updateTransaction(batchId, transaction);
            break;

          default:
            throw new ArgumentError(
              ErrorCodes.ArgumentInvalid,
              "Only actions 'Approve', 'Reset', 'Refund' and 'Update' are supported."
            );
        }

        BatchHelper.updateCounts(batch);
        batch.lastActionBy = Tenant.email;
        batch.lastActionDate = formatISO(new Date(), { representation: 'date' });

        if (batch.suspenseCount === 0) {
          batch.status = Batch.Status.Balanced;
        } else {
          batch.status = Batch.Status.Suspense;
        }

        await repository.saveBatch(batch);

        res.status(200).json(transaction);
      } else {
        throw new NotFoundError(ErrorCodes.NotFound, 'Batch not found.');
      }
    } else {
      res.status(404).json(new ErrorResult(ErrorCodes.NotFound, 'Transaction not found.'));
    }
  } catch (ex) {
    console.error(ex);

    if (ex instanceof NotFoundError) {
      res.status(404).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else if (ex instanceof ErrorResult) {
      res.status(400).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else {
      res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex.message));
    }
  }
};
