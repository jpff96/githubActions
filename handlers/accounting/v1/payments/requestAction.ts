import { ErrorResult, logError } from '@eclipsetechnology/eclipse-api-helpers';
import { formatISO, parseISO } from 'date-fns';
import { Request, Response } from 'express';
import { client } from '../../../../libs/dynamodb';
import { BalanceRecordType, PaymentTypes, providers } from '../../../../libs/enumLib';
import { ArgumentError } from '../../../../libs/errors/ArgumentError';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../../libs/errors/NotFoundError';
import Tenant from '../../../../libs/Tenant';
import {
  applyPaymentToOpenInvoices,
  generateStatementEvent,
  recordBalanceDue,
  recordPayment
} from '../../../../libs/Utils';
import { BillingRepository } from '../BillingRepository';
import { updateBillingDates } from '../business/billing';
import {
  applyCreditToInvoices,
  midTermInvoiceCreation as createInvoiceForBalanceDue,
  revertInvoicePayment
} from '../business/invoicing';
import { ActionRequest } from '../models/ActionRequest';
import { BalanceDue } from '../models/BalanceDue';
import { BalanceTransaction } from '../models/BalanceTransaction';
import { Invoice } from '../models/Invoice';
import { LineItem } from '../models/LineItem';
import { Payment } from '../models/Payment';
import { validateAction } from './validation/actionValidator';
import { LineItems } from '../../../accounting/v1/models/LineItems';
import * as math from 'mathjs';
import { createPremiumRefundFromLineItems } from '../business/refund';
import { handlePaymentTransfer } from '../manualActions/transfer';
import { DisbursementRepository } from '../../../disbursement/v1/DisbursementRepository';
import { Disbursement } from '../../../disbursement/v1/models/Disbursement';
import { rejectDisbursement } from '../../../disbursement/v1/helpers/rejectDisbursement';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { voidDisbursementPayment } from '../../../disbursement/v1/helpers/voidDisbursementPayment';
import { handlePaymentWithReinstate } from '../business/payments';

/**
 * Request an action to change or add a balance transaction record.
 * @param req Request data.
 * @param res Response
 * @returns Empty promise
 */
export const requestAction = async (req: Request, res: Response): Promise<void> => {
  try {
    // Load incoming data from event
    Tenant.init(req);
    const policyId = decodeURIComponent(req.params.id);

    validateAction(req.body);

    let balanceTransaction: BalanceTransaction;
    let balanceDue: BalanceDue;
    let payment: Payment;
    let invoice;
    const actionRequest = new ActionRequest(req.body);
    const {
      action,
      version,
      lineItem,
      isNsf,
      nsfAmount,
      entityId,
      description,
      termEffectiveDate,
      policyNumber,
      processedDateTime,
      reason
    } = actionRequest;
    const billingRepo = new BillingRepository(client);
    const billing = await billingRepo.get(policyId);

    switch (action) {
      case BalanceTransaction.Action.Nsf:
        // Record the balance table transaction
        balanceDue = new BalanceDue();
        balanceDue.balanceType = BalanceRecordType.Nsf;
        balanceDue.createDate = formatISO(parseISO(processedDateTime), { representation: 'date' });
        balanceDue.description = policyNumber;
        balanceDue.addLineItem(lineItem);
        balanceDue.policyNumber = policyNumber;
        balanceDue.version = version;

        balanceTransaction = await recordBalanceDue(balanceDue, policyId, entityId, termEffectiveDate);

        // Create invoice
        invoice = await createInvoiceForBalanceDue(policyId, balanceDue);

        // Resend statement?
        await generateStatementEvent(policyId, billing);
        await billingRepo.save(billing);
        break;

      case BalanceTransaction.Action.Reversal:
        payment = new Payment(actionRequest.payment);
        payment.negateLineItems();
        payment.description = 'Reversal ' + payment.description;
        payment.reason = reason;

        payment.processedDateTime = processedDateTime ?? new Date().toISOString();

        // Set invoice(s) to unpaid that were marked as paid
        for (const lineItems of payment.details) {
          if (lineItems.invoiceNumber) {
            await revertInvoicePayment(policyId, lineItems.invoiceNumber, lineItems.lineItems);
          }
        }

        const repository = new DisbursementRepository(client);
        // TODO - look for an existing disbursement and cancel if exists
        if (payment.disbursementId) {
          const disbursement = await repository.getDisbursementById(payment.disbursementId);

          if (disbursement) {
            // We are only trying to reverse this disbursement if it has not been sent yet to Vpay
            if (
              disbursement.state.state === Disbursement.States.Pending ||
              disbursement.state.state === Disbursement.States.Approved
            ) {
              const param = {
                rejectReason: 'The payment was reversed by an UW',
                paymentId: undefined,
                returnEvent: undefined,
                isEvent: false
              };
              await rejectDisbursement(disbursement, billing.agencyEntityId, param);
              await repository.saveDisbursement(
                disbursement,
                DisbursementRepository.DisbursementRecordType.Disbursement
              );
              await voidDisbursementPayment(disbursement);
            }
          }
        }

        // Add nsf entry if required (included in payload)
        // Nsf fee would come from the UI
        if (isNsf === true) {
          // TODO - get nsf fee and writing company from config
          //const [, productAccounting] = await ProductAPI.getConfiguration(payment.productKey);
          const nsf = nsfAmount || 25;
          const writingCompany = 'FPIC';

          const nsfInvoice = await Invoice.createNewInvoice(
            entityId,
            policyId,
            Invoice.InvoiceType.Nsf,
            policyNumber,
            payment.productKey,
            formatISO(new Date(), { representation: 'date' })
          );
          nsfInvoice.description = 'NSF';
          const nsfLineItem = LineItem.create(
            nsfAmount,
            LineItem.ItemType.Fee,
            LineItem.AccountType.Main,
            writingCompany
          );
          nsfInvoice.addLineItem(nsfLineItem);
          await billingRepo.saveInvoice(nsfInvoice);

          // Record the balance table transaction
          balanceDue = new BalanceDue();
          balanceDue.balanceType = BalanceRecordType.Nsf;
          balanceDue.createDate = formatISO(parseISO(processedDateTime), { representation: 'date' });
          balanceDue.description = description;
          balanceDue.reason = reason;
          balanceDue.addLineItem(nsfLineItem);
          balanceDue.policyNumber = policyNumber;
          balanceDue.version = version;

          balanceTransaction = await recordBalanceDue(balanceDue, policyId, entityId, termEffectiveDate);
        }

        balanceTransaction = await recordPayment(payment, policyId, entityId, version, termEffectiveDate);

        // We update the Billing equity and cancel date
        await updateBillingDates(billing);
        // send statement again
        // We should discuss when this statement will be regenerated
        // await generateStatementEvent(policyId, billing);

        await billingRepo.save(billing);

        await ActivityLogProducer.sendActivityLog(
          policyId,
          billing.agencyEntityId,
          'Reversed payment in the amount of {{amount}}, reference {{reference}}. Description: {{description}}.',
          {
            amount: math.abs(payment.subtotal),
            reference: balanceTransaction.typeDate,
            description: description
          }
        );
        break;

      case BalanceTransaction.Action.Writeoff:
        const writeOffLineItems = new LineItems();
        writeOffLineItems.addLineItem(lineItem);

        // For now we want to create a different record depending on whether its a nsf fee or an installment fee that is being written off
        if (
          lineItem.account === LineItem.AccountType.InstallmentFee ||
          lineItem.account === LineItem.AccountType.NsfFee
        ) {
          writeOffLineItems.negateLineItems();
          const newBalanceDue = new BalanceDue();
          newBalanceDue.addLineItems(writeOffLineItems.lineItems);
          newBalanceDue.version = version;
          newBalanceDue.description = 'Writeoff ' + description;
          newBalanceDue.reason = reason;
          newBalanceDue.balanceType = BalanceRecordType.WriteOff;
          newBalanceDue.dueDate = formatISO(new Date(), { representation: 'date' });
          newBalanceDue.effectiveDate = billing.effectiveDate;
          newBalanceDue.policyNumber = policyNumber;

          balanceTransaction = await recordBalanceDue(newBalanceDue, policyId, entityId, termEffectiveDate);

          // Since we added a new balance due record we should also create an invoice

          // We create the invoice for the amount that is being written off
          invoice = await Invoice.createNewInvoice(
            billing.ownerEntityId,
            billing.pk,
            Invoice.InvoiceType.WriteOff,
            billing.policyNumber,
            billing.productKey,
            formatISO(new Date(), { representation: 'date' })
          );

          invoice.addLineItems(writeOffLineItems.lineItems);
          await billingRepo.saveInvoice(invoice);
          // If this is a credit invoice we should be applying it to open invoices
          if (invoice.amountDue < 0) {
            await applyCreditToInvoices(billing);
          }
        } else {
          payment = new Payment();
          payment.policyNumber = billing.pk;
          payment.customerId = billing.userInformation.customerId;
          payment.processedDateTime = formatISO(new Date());
          // Are there any requirements for write off description?
          // Are there any requirements for the write off payment object?
          payment.description = 'Write off - ' + description;
          payment.reason = reason;
          // We always apply the absolute value to any open invvoices
          const remainingBalance = await applyPaymentToOpenInvoices(billing, writeOffLineItems.subtotal, payment);
          // If after trying to apply payment the remaining balance is negative it means that what was written off is
          // actually an overpamynet
          if (remainingBalance < 0) {
            writeOffLineItems.negateLineItems();
            payment.addLineItems(null, writeOffLineItems.lineItems);
          }

          await recordPayment(payment, policyId, billing.ownerEntityId, version, termEffectiveDate);

          // TODO: investigate if we need to reset delinquency status
          await updateBillingDates(billing);
          await billingRepo.save(billing);
        }

        await ActivityLogProducer.sendActivityLog(
          policyId,
          billing.agencyEntityId,
          'Write off of {{description}} for ${{amount}}.',
          {
            description,
            amount: math.abs(writeOffLineItems.subtotal)
          }
        );

        break;

      case BalanceTransaction.Action.Refund:
        const newLineItem = new LineItems();

        // We always refund a positive amount
        if (lineItem.amount < 0) {
          newLineItem.subtractLineItem(lineItem);
        } else {
          newLineItem.addLineItem(lineItem);
        }
        await createPremiumRefundFromLineItems(newLineItem.lineItems, policyId, billing.policyNumber, null);
        break;

      case BalanceTransaction.Action.Transfer:
        await handlePaymentTransfer(actionRequest, policyId, billing, billingRepo);

        break;

      case BalanceTransaction.Action.ManualPayment:
        payment = new Payment(actionRequest.payment);
        const now = new Date();
        const amount = math.abs(actionRequest.payment.subtotal);

        if (payment.checkNumber) {
          payment.accountLast4 = `${payment.paymentType} - ${payment.checkNumber.toString().slice(-4)}`;
        }

        payment.action = Payment.Actions.Payment;
        payment.cognitoUserId = Tenant.email;
        payment.description = actionRequest.description;
        payment.loanNumber = billing.mortgagee?.loanNumber;
        payment.paymentPlan = billing.paymentPlan?.planType;
        payment.policyNumber = actionRequest.policyNumber;
        payment.provider = providers.None;
        payment.providerFee = 0;
        payment.processedDateTime = now.toISOString();
        payment.reason = actionRequest.reason;
        payment.subtotal = 0;
        payment.subtotalPlusProviderFee = 0;
        payment.status = Payment.PaymentStatus.None;

        await ActivityLogProducer.sendActivityLog(
          policyId,
          billing.agencyEntityId,
          'Adding manual payment for ${{amount}} processed on {{transactionDateTime}}',
          {
            amount: amount,
            transactionDateTime: payment.processedDateTime
          }
        );

        await handlePaymentWithReinstate(policyId, amount, payment);

        break;

      default:
        throw new ArgumentError(ErrorCodes.ArgumentInvalid, `Unsupported action ${action} requested.`);
    }

    res.status(200).json(balanceTransaction);
  } catch (ex) {
    logError(console.log, ex, 'Action Request');

    if (ex instanceof NotFoundError) {
      res.status(404).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else if (ex instanceof ErrorResult) {
      res.status(400).json(new ErrorResult<ErrorCodes>(ex.code, ex.description));
    } else {
      res.status(500).json(new ErrorResult(ErrorCodes.Unknown, ex.message));
    }
  }
};
