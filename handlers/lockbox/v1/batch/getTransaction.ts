import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';
import { BillingRepository } from '../../../accounting/v1/BillingRepository';
import { LockboxRepository } from '../LockboxRepository';
import { CheckInvoice } from '../models/CheckInvoice';

/**
 * Gets single batch transaction record.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const getTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);

    const batchId = decodeURIComponent(req.params.id);
    const transId = decodeURIComponent(req.params.transId);

    const repository = new LockboxRepository(client);
    const batch = await repository.getBatch(batchId);

    if (batch) {
      const transaction = batch.transactions.find((x) => x.transactionId === transId);

      if (transaction) {
        if (transaction?.policyNumber) {
          const billingRepository = new BillingRepository(client);
          const billing = await billingRepository.get(`${batch.entityId}_${transaction.policyNumber}`);

          if (billing) {
            // Add invoice detail to transaction.
            const checkInvoice = new CheckInvoice();
            checkInvoice.balance = billing.paymentDetail.amountDue - transaction.amount;
            // TODO - set correct values when available in billing record.
            checkInvoice.companionPremium = 0;
            //checkInvoice.createdDate = billing.paymentDetail.invoiceDate;
            checkInvoice.installmentFee = 0;
            checkInvoice.invoiceAmount = billing.paymentDetail.amountDue;
            //checkInvoice.invoiceNumber = billing.paymentDetail.invoices[0].invoiceNumber;
            checkInvoice.policyPremium = billing.paymentDetail.amountDue; // ???? full premium amount?
            checkInvoice.premiumPlan = billing.paymentPlan.planType;

            transaction.dueDate = billing.dueDate;
            transaction.invoice = checkInvoice;
          }
        }

        res.status(200).json(transaction);
      } else {
        throw new NotFoundError(ErrorCodes.NotFound, 'Transaction not found.');
      }
    } else {
      throw new NotFoundError(ErrorCodes.NotFound, 'Batch not found.');
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
