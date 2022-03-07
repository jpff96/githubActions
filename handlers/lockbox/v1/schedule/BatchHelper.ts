import { formatISO } from 'date-fns';
import { EntityIDType } from '../../../../libs/constLib';
import { client } from '../../../../libs/dynamodb';
import { PaymentTypes, providers } from '../../../../libs/enumLib';
import Tenant from '../../../../libs/Tenant';
import { BillingRepository } from '../../../accounting/v1/BillingRepository';
import { handlePaymentWithReinstate } from '../../../accounting/v1/business/payments';
import { Invoice } from '../../../accounting/v1/models/Invoice';
import { Payment } from '../../../accounting/v1/models/Payment';
import { createDisbursements } from '../../../disbursement/v1/helpers/createDisbursements';
import { DisbursementPayload } from '../../../disbursement/v1/models';
import { LockboxRepository } from '../LockboxRepository';
import { Batch } from '../models/Batch';
import { CheckTransaction } from '../models/CheckTransaction';
import { uploadFilesToDocumentSystem } from './uploadFilesToDocumentSystem';

/**
 * Batch helper for validating each transaction.
 * @class BatchHelper
 */
export class BatchHelper {
  /**
   * Check the whole batch, skipping already approved transactions.
   * @param batch
   */
  static checkMatches = async (batch: Batch): Promise<Batch> => {
    for (let trans of batch.transactions) {
      if (
        trans.status === CheckTransaction.Status.Approved ||
        trans.status === CheckTransaction.Status.Matched ||
        trans.status === CheckTransaction.Status.Suspense
      ) {
        trans = await BatchHelper.checkTransaction(trans);
      }
    }

    batch = BatchHelper.updateCounts(batch);

    if (batch.suspenseCount === 0) {
      batch.status = Batch.Status.Balanced;
    }

    return batch;
  };

  /**
   * Check a single transaction.
   * @param transaction
   * @param isReset
   */
  static checkTransaction = async (transaction: CheckTransaction, isReset: boolean = false) => {
    const repository = new BillingRepository(client);
    transaction.errors = new Array<CheckTransaction.MatchErrors>();
    let isNotMatchingInvoice = false;
    let isMissingLoanNumber = false;

    // match policy number
    if (transaction.policyId && transaction.policyNumber != '99999999999') {
      const invoices = await repository.getInvoicesByStatus(transaction.policyId, Invoice.PaymentStatus.Pending);

      if (invoices) {
        if (!transaction.invoiceNumber) {
          // No invoice set, so look for the first invoice
          transaction.invoiceNumber = invoices.shift()?.invoiceNumber;
        }

        // Match invoice number
        const transInvoiceNumber = BatchHelper.removePadding(transaction.invoiceNumber);
        let invoice = invoices.find((x) => x.invoiceNumber === transInvoiceNumber);

        if (!invoice) {
          isNotMatchingInvoice = true;
          transaction.errors.push(CheckTransaction.MatchErrors.Invoice);
        }
      } else {
        isNotMatchingInvoice = true;
        transaction.errors.push(CheckTransaction.MatchErrors.Invoice);
      }

      const billing = await repository.get(transaction.policyId);

      if (billing) {
        // Match amount due
        if (billing.paymentDetail.amountDue !== transaction.amount) {
          isNotMatchingInvoice = true;
          transaction.errors.push(CheckTransaction.MatchErrors.Amount);
        }

        // Match loan number
        if (billing.mortgagee?.loanNumber) {
          const billingLoanNumber = BatchHelper.removePadding(billing.mortgagee.loanNumber);
          const transactonLoanNumber = BatchHelper.removePadding(transaction.loanNumber);

          if (billingLoanNumber.toUpperCase() !== transactonLoanNumber?.toUpperCase()) {
            isMissingLoanNumber = true;
            transaction.errors.push(CheckTransaction.MatchErrors.LoanNumber);
          }
        }
      } else {
        // No billing record was found, so the policy must not be valid
        transaction.errors.push(CheckTransaction.MatchErrors.PolicyId);
      }
    } else {
      transaction.errors.push(CheckTransaction.MatchErrors.PolicyId);
    }

    if (transaction.status !== CheckTransaction.Status.RefundApproved || isReset) {
      // Put into suspense when policy number error or when both the invoice and loan number do not match.
      if (transaction.errors.includes(CheckTransaction.MatchErrors.PolicyId) === false) {
        transaction.status = CheckTransaction.Status.Matched;
      } else if (
        transaction.errors.includes(CheckTransaction.MatchErrors.PolicyId) === true ||
        (isNotMatchingInvoice && isMissingLoanNumber)
      ) {
        transaction.status = CheckTransaction.Status.Suspense;
      } else {
        transaction.status = CheckTransaction.Status.Matched;
      }
    }

    return transaction;
  };

  /**
   * Release the whole batch.
   * @param batch
   */
  static releaseBatch = async (batch: Batch): Promise<Batch> => {
    const repository = new LockboxRepository(client);

    for (let trans of batch.transactions) {
      if (trans.status === CheckTransaction.Status.Approved || trans.status === CheckTransaction.Status.Matched) {
        await BatchHelper.releaseTransaction(batch, trans);
      } else if (trans.status === CheckTransaction.Status.RefundApproved) {
        await BatchHelper.refundTransaction(batch.entityId, trans);
      }

      // Update the batch overall status and count values.
      BatchHelper.updateCounts(batch);
      const appliedCount = batch.transactions.reduce(
        (count, transaction) =>
          transaction.status === CheckTransaction.Status.Applied || transaction.status === CheckTransaction.Status.RefundProcessed
            ? count + 1
            : count,
        0
      );

      if (appliedCount === batch.transactions.length) {
        batch.status = Batch.Status.Released;
      } else {
        if (batch.suspenseCount > 0) {
          batch.status = Batch.Status.Suspense;
        } else if (batch.suspenseCount === 0) {
          batch.status = Batch.Status.Balanced;
        }
      }

      batch.lastActionBy = Tenant.email;
      batch.lastActionDate = formatISO(new Date(), { representation: 'date' });

      await repository.saveBatch(batch);
    }

    return batch;
  };

  /**
   * Refund a single transaction.
   * @param batchId
   * @param transaction
   */
  static refundTransaction = async (batchId: string, transaction: CheckTransaction) => {
    try {
      const disbursementPayload = new DisbursementPayload(transaction);
      await createDisbursements(batchId, disbursementPayload);

      //Refund applied also gets Applied Status.
      transaction.status = CheckTransaction.Status.RefundProcessed;
    } catch (ex) {
      console.error(ex);
    }
  };

  /**
   * Release a single transaction.
   * @param batch
   * @param transaction
   */
  static releaseTransaction = async (batch: Batch, transaction: CheckTransaction) => {
    try {
      transaction.appliedDate = formatISO(new Date(), { representation: 'date' });

      const payment = new Payment();
      payment.accountLast4 = '';
      // per example with a transaction.checkNumber = 111111111333, accountLast4 will be setted as Check - 1333
      if (transaction.checkNumber) {
        payment.accountLast4 = 'Check - ' + transaction.checkNumber.toString().slice(-4);
      }
      payment.batchId = batch.batchId;
      payment.confirmationNumber = transaction.referenceId;
      payment.processedDateTime = transaction.appliedDate;
      payment.description = 'Premium Received';
      payment.providerFee = 0;
      payment.paymentType = PaymentTypes.CHECK;
      payment.provider = providers.Lockbox;
      payment.providerReference = transaction.transactionId;
      payment.policyNumber = transaction.policyNumber;
      payment.checkNumber = transaction.checkNumber;
      payment.images = transaction.images;
      payment.loanNumber = transaction.loanNumber;
      payment.postMarkDate = transaction.postMarkDate;
      payment.receivedDate = batch.processDate;

      // Update billing information. If this payment is short, then invoice
      // should be created.
      await handlePaymentWithReinstate(transaction.policyId, transaction.amount, payment);

      const tenantEntityId = EntityIDType.SOLSTICE; // Note: because this is cron the tenant is the sytem.
      const entityId = batch.entityId;
      const policyId = transaction.policyId;
      const referenceKey = transaction.policyId; // Note: For policy documents, the reference key is the policyId

      await uploadFilesToDocumentSystem(tenantEntityId, entityId, policyId, referenceKey, payment.images);

      transaction.status = CheckTransaction.Status.Applied;
    } catch (ex) {
      console.error(ex);
    }
  };

  /**
   *  Update approved and suspense counts
   * @param batch
   */
  static updateCounts = (batch: Batch): Batch => {
    const approvedCount = batch.transactions.reduce(
      (c, t) =>
        t.status === CheckTransaction.Status.Approved || t.status === CheckTransaction.Status.RefundApproved
          ? c + 1
          : c,
      0
    );
    const suspenseCount = batch.transactions.reduce(
      (c, t) => (t.status === CheckTransaction.Status.Suspense ? c + 1 : c),
      0
    );

    batch.approvedCount = approvedCount;
    batch.suspenseCount = suspenseCount;

    return batch;
  };

  /**
   * Removes any leading 0 values from a string as well as whitespace.
   * @param input String to remove padding from
   * @returns New string without padding.
   */
  private static removePadding = (input: string): string => {
    let output = '';

    if (input) {
      output = input.trim().replace(/^0+(?=\d)/, '');
    }

    return output;
  };
}
