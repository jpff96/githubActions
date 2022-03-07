import { addDays, formatISO, parseISO, isAfter } from 'date-fns';
import * as math from 'mathjs';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { client } from '../../../../libs/dynamodb';
import { AccountingDocType, BalanceRecordType } from '../../../../libs/enumLib';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { applyPaymentToOpenInvoices, getOpenInvoices, isDue, recordBalanceDue } from '../../../../libs/Utils';
import { Bill2Pay, evenRound } from '../../../bill2pay/bill2Pay';
import { BalanceRepository } from '../BalanceRepository';
import { BillingRepository } from '../BillingRepository';
import { BalanceDue } from '../models/BalanceDue';
import { Billing } from '../models/Billing';
import { BillingStatus } from '../models/BillingStatus';
import { IBalanceTransaction } from '../models/IBalanceTransaction';
import { Invoice } from '../models/Invoice';
import { LineItem } from '../models/LineItem';
import { LineItems } from '../models/LineItems';
import { Payment } from '../models/Payment';
import { PaymentDetail } from '../models/PaymentDetail';
import { PaymentPlan } from '../models/PaymentPlan';
import { generateInstallmentFeeBalanceDue } from './installment';
import { markInvoicePaid } from './invoicing';
import { updatePaymentLineItems } from './payments';
import { getReinstatmentLineItems } from './reinstatement';

/**
 * Sets the billing record from an incoming balance due.
 * @param policyId The policy Id.
 * @param agencyEntityId The agency entity Id.
 * @param balanceDue The balance due object.
 * @param effectiveDate Term or transaction effective date.
 * @param expirationDate Term expiration date .
 * @param productKey The product key.
 */
export const setBillingFromBalanceDue = async (
  policyId: any,
  agencyEntityId: string,
  balanceDue: BalanceDue,
  effectiveDate: string,
  expirationDate: string,
  productKey: string,
  ownerEntityId?: string
) => {
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);

  if (billing) {
    const paymentDetail = new PaymentDetail(billing.paymentDetail);
    for (const lineItem of balanceDue.lineItems) {
      paymentDetail.addLineItem(lineItem);
    }
    billing.paymentDetail = paymentDetail;
    billing.effectiveDate = effectiveDate;
    billing.expirationDate = expirationDate;
    billing.productKey = productKey;
    billing.ownerEntityId = ownerEntityId;
    billing.agencyEntityId = agencyEntityId;

    await billingRepo.save(billing);
  } else {
    // Then we save the information regarding the payment
    const newBilling = new Billing();
    newBilling.pk = policyId;
    newBilling.agencyEntityId = agencyEntityId;
    newBilling.effectiveDate = effectiveDate;
    newBilling.expirationDate = expirationDate;
    newBilling.productKey = productKey;
    newBilling.paymentDetail = new PaymentDetail();
    newBilling.paymentDetail.lineItems = [];
    newBilling.ownerEntityId = ownerEntityId;

    if (balanceDue.balanceType === BalanceRecordType.MainBalanceDue) {
      newBilling.policyNumber = balanceDue.policyNumber;
    } else {
      newBilling.companionNumber = balanceDue.policyNumber;
    }

    for (const lineItem of balanceDue.lineItems) {
      newBilling.paymentDetail.addLineItem(lineItem);
    }

    await billingRepo.save(newBilling);
  }
};

/**
 * Sets the billing record from an incoming balance due.
 * @param policyId The policy Id.
 * @param balanceDue The balance due object.
 */
export const updateBillingFromPolicyCancel = async (
  policyId: any,
  balanceDue: BalanceDue,
  cancellationDate: string
) => {
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepo.get(policyId);

  if (billing) {
    const invoices = await billingRepo.getInvoicesByStatus(policyId, Invoice.PaymentStatus.Pending);

    if (balanceDue.balanceType === BalanceRecordType.CompanionCancellation) {
      // Create offset invoice for any pending invoices
      if (invoices.length > 0) {
        const invoice = await Invoice.createNewInvoice(
          billing.userInformation.entityId,
          policyId,
          Invoice.InvoiceType.MidTermChange,
          billing.policyNumber,
          billing.productKey,
          formatISO(new Date(), { representation: 'date' })
        );

        let shouldVoid: boolean;
        for (const inv of invoices) {
          shouldVoid = false;
          for (const lineItem of inv.invoiceLineItems) {
            if (
              lineItem.account === LineItem.AccountType.Companion ||
              lineItem.account === LineItem.AccountType.CompanionPolicyFee ||
              lineItem.account === LineItem.AccountType.DFS ||
              lineItem.account === LineItem.AccountType.FSLSO
            ) {
              shouldVoid = true;

              // Add line items to offset companion values
              invoice.subtractLineItem(lineItem);
            }
          }

          if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay && shouldVoid === true) {
            // Void the invoices so they can be regenarated without companion lineItems
            inv.paymentStatus = Invoice.PaymentStatus.Void;
            await billingRepo.saveInvoice(inv);
          }
        }

        if (invoice.amountDue !== 0) {
          markInvoicePaid(invoice);
          await billingRepo.saveInvoice(invoice);
        }
      }
    } else {
      // Stop all billing activity for this policy.
      delete billing.dueDate;
      delete billing.cancelDate;
      billing.paymentDetail.amountDue = 0;
      billing.cancellationDate = cancellationDate;

      // Mark all pending invoices as void
      for (const invoice of invoices) {
        // We only mark pending invoices as already paid invoices should remain like that
        if (invoice.paymentStatus === Invoice.PaymentStatus.Pending) {
          // These voided invoices are added to the list of voided invoices inside the paymentDetail
          // First we clean the list of voided invoices
          billing.paymentDetail.listOfVoidedInvoices = [];
          // Then we add each voided invoice to that same list so we can use them later when reinstating the policy
          billing.paymentDetail.listOfVoidedInvoices.push(invoice.invoiceNumber);
          invoice.paymentStatus = Invoice.PaymentStatus.Void;
          await billingRepo.saveInvoice(invoice);
        }
      }
    }

    await billingRepo.save(billing);
  }
};

/**
 * Updates the billing record's equity and cancel date based on the premium changes
 * @param billing The billing record of the policy.
 */

export const updateBillingEquity = async (billing: Billing) => {
  const balanceRepo = new BalanceRepository(client);
  const records = await balanceRepo.getTransactions(billing.pk, billing.effectiveDate);
  let balanceDuePremiums = 0;
  let paymentPremiums = 0;

  for (const rec of records) {
    if (rec.balanceDue) {
      const tempBalanceDue = new BalanceDue(rec.balanceDue);
      balanceDuePremiums = evenRound(
        balanceDuePremiums + tempBalanceDue.getTotalPremiums(LineItem.AccountType.Main),
        2
      );
    } else if (rec.payment) {
      const tempPayment = new Payment(rec.payment);
      paymentPremiums = evenRound(paymentPremiums + tempPayment.getTotalPremiums(LineItem.AccountType.Main), 2);
    }
  }
  // The new policy equity should be calculated using the main and companion premium plus the main and companion premium from the change divided by 365
  const newPolicyEquity = balanceDuePremiums / 365;
  billing.policyEquity = newPolicyEquity;

  // We calculate how many days were generated with the amount paid so far
  let equityDaysGenerated = Math.floor(math.abs(paymentPremiums) / billing.policyEquity);

  if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay) {
    // Because the amount paid actually generates more than 60 days but less than 61 we
    // give an advantage to the insured so that we dont have to refund anything should
    // the policy be cancelled for non payment (since the amount paid would be more than the days generated)
    equityDaysGenerated += 1;
  }

  // The new cancel date will be moved based on how much has been paid so far and the new policy equity

  billing.cancelDate = formatISO(addDays(parseISO(billing.effectiveDate), equityDaysGenerated), {
    representation: 'date'
  });

  return billing;
};

/**
 * Updates the billing record when a reinstatement is possible
 * @param policyId The policyId
 * @param balanceDue The balance due object that
 */
export const updateBillingFromReinstatement = async (policyId: string) => {
  const balanceRepository = new BalanceRepository(client);
  const billingRepository = new BillingRepository(client);
  const billingRepo = new BillingRepository(client);
  const billing = await billingRepository.get(policyId);
  const paidLineItems = new LineItems();

  // TODO: use new method added in another task to get how much is due in the policy
  // We then create an invoice from what is due
  const paymentLineItems = await getReinstatmentLineItems(policyId, billing);
  const newInvoice = await Invoice.createNewInvoice(
    billing.ownerEntityId,
    policyId,
    Invoice.InvoiceType.Reinstatement,
    billing.policyNumber,
    billing.productKey,
    formatISO(new Date(), { representation: 'date' })
  );
  newInvoice.addLineItems(paymentLineItems.lineItems);
  await billingRepo.saveInvoice(newInvoice);

  if (billing.paymentPlan.responsibleParty === PaymentPlan.ResponsibleParty.Insured) {
    if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay) {
      const installmentFeeBalanceDue = await generateInstallmentFeeBalanceDue(billing);
      // TODO: Each balance record received should update the billing record with a term effective date so we always have the current term.
      // Then at renewal it could change to the new term. Just thinking how we could get this to be the correct date since this will be important soon.
      await recordBalanceDue(installmentFeeBalanceDue, billing.pk, billing.ownerEntityId, billing.effectiveDate);

      for (const installment of billing.paymentDetail.listOfInstallments) {
        if (isDue(installment.dueDate) === true) {
          if (installment.paid === false) {
            installment.paid = true;
            installment.invoiceCreated = true;
            if (billing.paymentDetail.installmentsLeft > 0) {
              billing.paymentDetail.installmentsLeft--;
            }
          }
        } else {
          // If the instalment isnt due and thhe invoice for this installment was already created we need to change it so the cronjob can pick it up again
          if (installment.invoiceCreated === true) {
            installment.invoiceCreated = false;
          }
        }
      }
      const installment = billing.paymentDetail.listOfInstallments.find((elem) => elem.paid === false);
      if (installment) {
        // If theres an installment that needs to be paid we set the next due date to that
        billing.dueDate = installment.dueDate;
      } else {
        // Otherwise the due date is the expiration date since the installments have been paid
        billing.dueDate = billing.expirationDate;
      }
    } else if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.FullPay) {
      // If the policy is Full Pay the due date is the expiration date as payment must be the whole amount
      billing.dueDate = billing.expirationDate;
    }
  } else if (billing.paymentPlan.responsibleParty === PaymentPlan.ResponsibleParty.Mortgagee) {
    // If the policy is lender paid the duedate depends on whether or not it has been fully paid
    if (billing.paymentDetail.totalAmountPaid === billing.paymentDetail.amountDue) {
      billing.dueDate = billing.expirationDate;
    }
    // If there's still something left to pay then the due date doesn't change and we create a new statement
    // TODO: Set isStatementSent flag to false so the cronjob can pick this policy and send a new statement
  }

  const paymentTransactions = await balanceRepository.getTransactions(
    policyId,
    billing.effectiveDate,
    AccountingDocType.Payment
  );

  await applyUnpaidPaymentsToOpenInvoices(paymentTransactions, billing, policyId);

  billing.paymentDetail.totalAmountPaid = evenRound(billing.paymentDetail.totalAmountPaid + paidLineItems.subtotal, 2);
  // If the total balanceDue isn't updated fast enough we may need to move this to the updateTotals lambda so it updates the billing equity everytime there is a change in premium
  // Keep this in mind if there are any issues with how the equity is calculated
  await updateBillingDates(billing);
  await billingRepository.save(billing);
};

/**
 * Apply unpaid payments to open invoices
 * @param paymentTransactions The paymentTransactions which has money to be applied
 * @param billing The billing record of the policy.
 * @param policyId The policyId
 */
export const applyUnpaidPaymentsToOpenInvoices = async (
  paymentTransactions: IBalanceTransaction[],
  billing: Billing,
  policyId: string
) => {
  //TODO: we should check payment status (paid - unpaid) when we add the actions to each payment
  const unappliedPayments = paymentTransactions.filter(
    (paymentTransaction) =>
      paymentTransaction?.payment?.details.some((lineItem) => !lineItem.invoiceNumber) === true
  );

  for (const unappliedPayment of unappliedPayments) {
    const paymentObject = new Payment(unappliedPayment?.payment);
    const amountPaid = evenRound(math.abs(
      paymentObject?.details.reduce((amountUnpaid, currentLineItem) => {
        if (!currentLineItem.invoiceNumber && currentLineItem.subtotal < 0) {
          amountUnpaid = amountUnpaid + currentLineItem.subtotal;
        }
        return amountUnpaid;
      }, 0)
    ), 2);

    // We clear the line items so we can get the correct line items from the invoice paid
    paymentObject.clearLineItems();

    await applyPaymentToOpenInvoices(billing, amountPaid, paymentObject);
    await updatePaymentLineItems(policyId, unappliedPayment.typeDate, paymentObject);
  }
};
/**
 * Updates the due date on the billing record
 * @param billing The Billing record
 */
export const updateDueDate = async (billing: Billing) => {
  const policyId = billing.pk;
  // We set the billing due date to the expiration date and then we move it if its needed
  billing.dueDate = billing.expirationDate;

  // First we check any open invoices
  const openInvoices = await getOpenInvoices(policyId);

  // If there are any we get the earlies invoice's due date which is always the first invoice
  if (openInvoices.length > 0) {
    billing.dueDate = openInvoices[0].dueDate;
  } else {
    // If there are no open invoices then due dates depends on paymentplan
    if (billing.paymentPlan.responsibleParty === PaymentPlan.ResponsibleParty.Insured) {
      if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay) {
        const installment = billing.paymentDetail.listOfInstallments.find((elem) => elem.paid === false);

        if (installment) {
          billing.dueDate = installment.dueDate;
        }
      }
    }
  }
};

/**
 * Updates dates on the billing record
 * @param policyId The Billing record
 */
export const updateBillingDates = async (billing: Billing) => {
  const balanceRepo = new BalanceRepository(client);

  // First we check for any open invoices
  const openInvoices = await getOpenInvoices(billing.pk);

  const records = await balanceRepo.getTransactions(billing.pk, billing.effectiveDate);
  let balanceDuePremiums = 0;
  let paymentPremiums = 0;
  let equityDaysGenerated = 0;
  let paymentReceived = false;

  for (const rec of records) {
    if (rec.balanceDue) {
      const tempBalanceDue = new BalanceDue(rec.balanceDue);
      balanceDuePremiums = evenRound(
        balanceDuePremiums + tempBalanceDue.getTotalPremiums(LineItem.AccountType.Main),
        2
      );
    } else if (rec.payment) {
      const tempPayment = new Payment(rec.payment);
      paymentPremiums = evenRound(paymentPremiums + tempPayment.getTotalPremiums(LineItem.AccountType.Main), 2);
      // We assume that if we received a payment then we can update the dates as usual
      // This is so we dont update billing dates when the policy is mortgagee billed before payment is received
      paymentReceived = true;
    }
  }

  if (billing.paymentPlan.responsibleParty === PaymentPlan.ResponsibleParty.Mortgagee && paymentReceived === false) {
    // If we haven't received payment for the new business invoice yet we use custom rules for
    // the due date and cancel date
    // Mortgagee billed policy rules:
    // DueDate: 15 days after effective date.
    // Cancel Date: 30 days after effective date
    // TODO: Pull these values from the product config
    // We set the cancel date 30 days after the policy effective date TODO: Pull this value from product configuration
    billing.cancelDate = formatISO(addDays(parseISO(billing.effectiveDate), 30), {
      representation: 'date'
    });
    // We set the due date 15 days after the policy effective date TODO: Pull this value from product configuration
    billing.dueDate = formatISO(addDays(parseISO(billing.effectiveDate), 15), {
      representation: 'date'
    });
  } else {
    // If balanceDuePremiums is equals to 0 is not necessary to re-calculate the equity days
    if (balanceDuePremiums > 0) {
      // The new policy equity should be calculated using the main and companion premium plus the main and companion premium from the change divided by 365
      const newPolicyEquity = balanceDuePremiums / 365;
      billing.policyEquity = newPolicyEquity;

      // We calculate how many days were generated with the amount paid so far
      equityDaysGenerated = Math.floor(math.abs(paymentPremiums) / billing.policyEquity);

      if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay) {
        // Because the amount paid actually generates more than 60 days but less than 61 we
        // give an advantage to the insured so that we dont have to refund anything should
        // the policy be cancelled for non payment (since the amount paid would be more than the days generated)
        equityDaysGenerated += 1;
      }
    }

    // The new cancel date will be moved based on how much has been paid so far and the new policy equity
    billing.cancelDate = formatISO(addDays(parseISO(billing.effectiveDate), equityDaysGenerated), {
      representation: 'date'
    });

    // Cancellation date can not be bigger than the expiration date.
    // In case that happens the cancelDate will be equals to the expirationDate.
    if (isAfter(parseISO(billing.cancelDate), parseISO(billing.expirationDate))) {
      billing.cancelDate = billing.expirationDate;
    }

    // We set the billing due date to the expiration date and then we move it if its needed
    billing.dueDate = billing.expirationDate;

    // If there are any we get the earlies invoice's due date which is always the first invoice
    if (openInvoices.length > 0) {
      billing.dueDate = openInvoices[0].dueDate;
    } else {
      // If there are no open invoices then due dates depends on paymentplan
      if (billing.paymentPlan.responsibleParty === PaymentPlan.ResponsibleParty.Insured) {
        if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay) {
          const installment = billing.paymentDetail.listOfInstallments.find((elem) => elem.paid === false);

          if (installment) {
            billing.dueDate = installment.dueDate;
          }
        }
      }
    }
  }
};

/**
 * Changes the delinquency status to default
 * @param billing The billing record of the policy
 */
export const resetDelinquencyStatus = async (billing: Billing, transactionDateTime: string) => {
  // Delinquency process check
  const delinquencyStatus = billing.billingStatus.delinquencyStatus;
  if (
    delinquencyStatus === BillingStatus.DelinquencyStatus.DelinquencyProcessStarted ||
    delinquencyStatus === BillingStatus.DelinquencyStatus.DelinquencyCompleted
  ) {
    // After payment is successful we revert the delinquency process
    billing.billingStatus.delinquencyStatus = BillingStatus.DelinquencyStatus.DelinquencyProcessNotStarted;
    const delinquencyDetail = ServiceEventProducer.createDelinquencyEventDetail(
      billing.cancelDate,
      billing.pk,
      billing.paymentPlan.responsibleParty
    );
    await ServiceEventProducer.sendServiceEvent(
      delinquencyDetail,
      ServiceEventProducer.DetailType.DelinquencyProcessAverted
    );
    await ActivityLogProducer.sendActivityLog(
      billing.pk,
      billing.agencyEntityId,
      'Delinquency process averted, payment recevied on: {{transactionDateTime}}',
      {
        transactionDateTime
      }
    );
  }
};

/**
 * Removes electronic payment methods
 * @param billing The billing record of the policy
 */
export const removeElectronicPaymentMethods = async (billing: Billing) => {
  const bill2pay = new Bill2Pay();
  const result = await bill2pay.listPaymentMethods(billing.userInformation.customerId, billing.ownerEntityId);

  for (const paymentMethod of result.listOfMethods) {
    await bill2pay.deletePaymentMethod(billing.userInformation.customerId, billing.ownerEntityId, paymentMethod.token);
  }
};
