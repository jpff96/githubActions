import { logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import { addDays, formatISO, parseISO } from 'date-fns';
import { client } from '../../../../libs/dynamodb';
import { BalanceRecordType } from '../../../../libs/enumLib';
import {
  getAmountDueLeft,
  getOpenInvoices,
  isDue,
  markInstallmentPaid,
  getTotalBalanceDue
} from '../../../../libs/Utils';
import { evenRound } from '../../../bill2pay/bill2Pay';
import { BillingRepository } from '../BillingRepository';
import { BalanceDue } from '../models/BalanceDue';
import { Billing } from '../models/Billing';
import { Installment } from '../models/Installment';
import { InstallmentCalculatorRequest } from '../models/InstallmentCalculatorRequest';
import { Invoice } from '../models/Invoice';
import { InvoiceLineItem } from '../models/InvoiceLineItem';
import { LineItem } from '../models/LineItem';
import { LineItems } from '../models/LineItems';
import { NextInstallmentAmountDueResult } from '../models/NextInstallmentAmountDueResult';
import { PaymentPlan } from '../models/PaymentPlan';
import { markInvoicePaid } from './invoicing';

/**
 * Creates an installment fee invoice
 * @param billing The billing record corresponding to the policy
 * @param amount The amount of money used to apply money
 * @returns the amount updated
 */
export const generateInstallmentFeeInvoice = async (billing: Billing) => {
  const billingRepo = new BillingRepository(client);

  const invoice = await Invoice.createNewInvoice(
    billing.userInformation.entityId,
    billing.pk,
    Invoice.InvoiceType.InstallmentFee,
    billing.policyNumber,
    billing.productKey,
    formatISO(new Date(), { representation: 'date' })
  );
  const balanceDue = await getTotalBalanceDue(billing.pk, billing.effectiveDate);
  const totalPremiumDue = balanceDue.getTotalPremiums();
  const installmentFeeAmount = getInstallmentFee(totalPremiumDue);

  invoice.addLineItem(
    new InvoiceLineItem({
      amount: installmentFeeAmount,
      itemType: LineItem.ItemType.Fee,
      account: LineItem.AccountType.InstallmentFee,
      writingCompany: 'FPIC'
    })
  );
  await billingRepo.saveInvoice(invoice);

  return invoice;
};

/**
 * Generates an installmentFee balanceDue record
 * @param billing The billing record
 */
export const generateInstallmentFeeBalanceDue = async (billing: Billing) => {
  const balanceDue = await getTotalBalanceDue(billing.pk, billing.effectiveDate);
  const totalPremiumDue = balanceDue.getTotalPremiums();
  const installmentFeeAmount = getInstallmentFee(totalPremiumDue);

  const installmentFeeBalanceDue = new BalanceDue({
    balanceType: BalanceRecordType.InstallmentFee,
    description: 'Installment Fee',
    dueDate: formatISO(new Date(), { representation: 'date' }),
    policyNumber: billing.policyNumber
  });

  installmentFeeBalanceDue.addLineItem(
    new LineItem({
      amount: installmentFeeAmount,
      itemType: LineItem.ItemType.Fee,
      account: LineItem.AccountType.InstallmentFee,
      // TODO: Pull this from the product configuration, writingCompany should not be hardcoded, it is part of the policy record
      writingCompany: 'FPIC'
    })
  );
  return installmentFeeBalanceDue;
};

/**
 * Obtains a installment schedule for a given set of amounts.
 * @param installmentsCalcData Contains mainPremium, companionPremium, fees and taxes and an effectiveDate.
 */
export const getInstallmentInfo = (installmentsCalcData: InstallmentCalculatorRequest) => {
  let installmentFee;
  let installments;

  const mainPremium = installmentsCalcData.mainPremium;
  const companionPremium = installmentsCalcData.companionPremium;
  const totalPremiums = mainPremium + companionPremium;
  const totalFees = installmentsCalcData.totalFees;
  const totalTaxes = installmentsCalcData.totalTaxes;

  installmentFee = getInstallmentFee(totalPremiums);

  // Create a set of LineItem from the amounts we have in the installmentsCalcData object.
  // This is because the function getListOfInstallmentsPrePolicyPayment works with LineItem to calculate
  // the installments.
  const amountsToLineItems = new LineItems();
  amountsToLineItems.addLineItem(
    new LineItem({
      account: LineItem.AccountType.Main,
      amount: mainPremium,
      itemType: LineItem.ItemType.Premium
    })
  );
  amountsToLineItems.addLineItem(
    new LineItem({
      account: LineItem.AccountType.Companion,
      amount: companionPremium,
      itemType: LineItem.ItemType.Premium
    })
  );
  amountsToLineItems.addLineItem(
    new LineItem({
      amount: totalFees,
      itemType: LineItem.ItemType.Fee
    })
  );
  amountsToLineItems.addLineItem(
    new LineItem({
      amount: totalTaxes,
      itemType: LineItem.ItemType.Tax
    })
  );

  installments = getListOfInstallmentsPrePolicyPayment(
    installmentFee,
    installmentsCalcData.effectiveDate,
    amountsToLineItems,
    true
  );

  let installmentsData = {
    // Total amount that must be paid not including installmentFees
    totalAmount: installmentsCalcData.totalAmount,
    mainPremium: installmentsCalcData.mainPremium,
    companionPremium: installmentsCalcData.companionPremium,
    totalFeesAndTaxes: installmentsCalcData.totalFeesAndTaxes,
    installmentsLeft: 10,
    // The installmentFee depends on the total premium of both home and companion to be paid and it's value is calcultaed before
    installmentFee,
    installments: installments
  };

  return installmentsData;
};

/**
 * Calculates the installment fee for this total premium
 * @param totalPremium
 * @returns
 */
export const getInstallmentFee = (totalPremium: number) => {
  let fee = 0;

  // TODO: Pull these values from the Product Configuration
  if (150 <= totalPremium && totalPremium < 500) {
    fee = 1;
  } else if (500 <= totalPremium && totalPremium < 1000) {
    fee = 2;
  } else if (1000 <= totalPremium && totalPremium < 2000) {
    fee = 4;
  } else if (2000 <= totalPremium && totalPremium < 3000) {
    fee = 6;
  } else if (3000 <= totalPremium && totalPremium < 4000) {
    fee = 8;
  } else if (4000 <= totalPremium && totalPremium < 5000) {
    fee = 9;
  } else if (5000 <= totalPremium && totalPremium < 7000) {
    fee = 10;
  } else if (7000 <= totalPremium && totalPremium < 8000) {
    fee = 11;
  } else if (8000 <= totalPremium && totalPremium < 9000) {
    fee = 12;
  } else if (9000 <= totalPremium && totalPremium < 10000) {
    fee = 13;
  } else if (10000 <= totalPremium) {
    fee = 14;
  }

  return fee;
};

/**
 *  Reduces a certain amount on the installment
 * @param billing The policyId of the policy
 * @param installmentNumber The installment number of the installment to be reduced
 * @param amountReduced The amount to reduce from the installment
 */
export const reduceInstallment = (billing: Billing, installmentNumber: number, amountReduced: number) => {
  const index = billing.paymentDetail.listOfInstallments.findIndex(
    (elem) => elem.installmentNumber === installmentNumber
  );
  if (index >= 0) {
    const installment = new Installment(billing.paymentDetail.listOfInstallments[index]);
    installment.reduceByAmount(amountReduced);
    billing.paymentDetail.listOfInstallments[index] = installment;
  }
};
/**
 * Handles the updates needed after an installment invoice is adjusted
 * @param invoice The invoice that was changed
 * @param amount The amount needed in case we apply anything
 * @param processedDateTime The date time to update the invoice in case its needed
 * @param amountReduced The amount that was reduced if it was a premium decrease
 */
export const handleInstallmentInvoiceUpdate = async (
  invoice: Invoice,
  billing: Billing,
  processedDateTime: string,
  decreasesPremium: boolean = false,
  amountReduced?: number
) => {
  // If the invoice installment has been fully paid we have to create an invoice for the installment fee and apply money
  if (invoice.invoiceType === Invoice.InvoiceType.Installment) {
    if (decreasesPremium === true) {
      // If this is a premium decrease and an installment invoice was reduced then we have to also update the list of installments with the new amount
      reduceInstallment(billing, invoice.installmentNumber, amountReduced);
    }

    if (invoice.amountPaid === invoice.amountDue) {
      markInstallmentPaid(billing, invoice.installmentNumber, processedDateTime);
    }
  } else if (invoice.invoiceType === Invoice.InvoiceType.FirstDownPayment && invoice.amountPaid === invoice.amountDue) {
    markInstallmentPaid(billing, invoice.installmentNumber, processedDateTime);
  }
};

/**
 * Calculates the amount due for the next installment
 * @param billing The billing record
 */
export const nextInstallmentAmountDue = async (billing: Billing): Promise<NextInstallmentAmountDueResult> => {
  let installmentInvoice = false;
  const result = new NextInstallmentAmountDueResult();
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');
  const billingRepo = new BillingRepository(client);

  const openInvoices = await billingRepo.getInvoicesByStatus(billing.pk, Invoice.PaymentStatus.Pending);

  // Then we get all invoices that are not paid and have positive amount duess (not refund)
  const unpaidInvoices = openInvoices.filter((elem) => {
    // If the invoice duedate is after today means that we shouldnt process the payment
    // We want to return the invoices who's due dates are not after the billing due date
    return isDue(elem.dueDate);
  });
  logTrace(loggerInfo, '🚀', 'billing-open-unpaid-invoices', unpaidInvoices);

  // We need to know how much credit the user has before applying payments
  for (const invoice of unpaidInvoices) {
    if (invoice.paymentAttempted === false) {
      invoice.paymentAttempted = true;
      // This should be done independent of this flow and in memory in case something fails
      await billingRepo.saveInvoice(invoice);

      result.amountToBePaid = evenRound(result.amountToBePaid + invoice.amountDue, 2);
      // If its an installment invoice we need to pay for the installment fee so we add that to the amount to be paid
      // for each installment invoice that is open
      if (invoice.invoiceType === Invoice.InvoiceType.Installment) {
        installmentInvoice = true;
      } else if (invoice.invoiceType === Invoice.InvoiceType.FirstDownPayment) {
        result.isFirstPayment = true;
      }
    }
  }
  if (installmentInvoice === true) {
    const balanceDue = await getTotalBalanceDue(billing.pk, billing.effectiveDate);
    const totalPremiumDue = balanceDue.getTotalPremiums();
    const fee = getInstallmentFee(totalPremiumDue);
    result.amountToBePaid = evenRound(result.amountToBePaid + fee, 2);
  }
  return result;
};
/**
 * Gets the amount of installments left to be paid
 * @param billing
 */
export const getInstallmentsLeft = (billing: Billing) => {
  let installmentsLeft = 0;
  if (billing.paymentDetail.listOfInstallments.length > 0) {
    for (const installment of billing.paymentDetail.listOfInstallments) {
      if (installment.paid === false) {
        installmentsLeft++;
      }
    }
  }
  return installmentsLeft;
};

/**
 * Updates the billing record as if an installment was just paid
 * @param billing The billing record to update
 */
export const installmentPaid = (billing: Billing, noPayment: boolean = false) => {
  if (billing.paymentPlan.planType === PaymentPlan.PaymentPlanType.ElevenPay) {
    billing.paymentDetail.installmentsLeft--;
    const installmentIndex = billing.paymentDetail.listOfInstallments.findIndex((elem) => elem.paid === false);
    if (installmentIndex >= 0) {
      throw new Error('There are no more installments left to be paid');
    } else {
      const installment = new Installment(billing.paymentDetail.listOfInstallments[installmentIndex]);
      installment.paid = true;
      installment.processedDateTime = formatISO(new Date());
      // If there was no payment received for this installment then we
      if (noPayment) {
        installment.clearLineItems();
        installment.installmentFee = 0;
      }
      billing.paymentDetail.listOfInstallments[installmentIndex] = installment;
    }
  } else {
    throw new Error('The policy is not an eleven pay policy');
  }
};

/**
 * Gets the amount left from installments
 * @param billing The billing record
 */
export const getAmoundDueFromInstallments = (billing: Billing) => {
  let installmentsAmountLeft = 0;
  for (const installment of billing.paymentDetail.listOfInstallments) {
    if (installment.paid === false) {
      installmentsAmountLeft = evenRound(installmentsAmountLeft + installment.subtotal, 2);
    }
  }
  return installmentsAmountLeft;
};

/**
 * Recalculates the list of installments
 * @param billing The policyId of the policy
 */
export const recalculateInstallments = async (billing: Billing) => {
  const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');
  const billingRepo = new BillingRepository(client);
  const amountDueLeft = await getAmountDueLeft(billing.pk, billing.effectiveDate);
  const totalDueLeftLineItms = new LineItems();
  totalDueLeftLineItms.addLineItems(amountDueLeft.lineItems);

  const amountDueleftSubtotal = amountDueLeft.subtotal;
  const openInvoices = await getOpenInvoices(billing.pk);
  logTrace(loggerInfo, '🚀', 'recalculateInstallments-amountDueLeft', amountDueLeft);
  logTrace(loggerInfo, '🚀', 'recalculateInstallments-openInvoices', openInvoices);
  logTrace(loggerInfo, '🚀', 'recalculateInstallments-billing', billing);

  if (amountDueleftSubtotal <= 0) {
    // If the amount due left on the policy is negative means that everything has to be marked as paid and a refund has to be triggered
    for (let index = 0; index < billing.paymentDetail.listOfInstallments.length; index++) {
      const installment = new Installment(billing.paymentDetail.listOfInstallments[index]);
      if (installment.paid === false) {
        installment.clearLineItems();
        installment.installmentFee = 0;
        installment.paid = true;
        installment.processedDateTime = formatISO(new Date(), { representation: 'date' });

        if (installment.invoiceCreated === true) {
          // We need to fetch the open invoice so we can mark it as paid
          // TODO: If at some point we have multiple invoices for one installment we need to change this to an array
          const invoice = openInvoices.find((elem) => elem.installmentNumber === installment.installmentNumber);
          if (invoice) {
            // The amount to apply should make the invoice be fully paid
            const amountToApply = evenRound(invoice.amountDue - invoice.amountPaid, 2);
            invoice.applyToInvoiceLineItems(amountToApply);
            markInvoicePaid(invoice);
            await billingRepo.saveInvoice(invoice);
          }
        }
        billing.paymentDetail.listOfInstallments[index] = installment;
      }
    }
  } else {
    // TODO: Create new method to get installments left
    const installmentsLeft = billing.paymentDetail.installmentsLeft;
    const installmentNewAmount = evenRound(amountDueleftSubtotal / installmentsLeft, 2);
    logTrace(loggerInfo, '🚀', 'recalculateInstallments-installmentNewAmount', installmentNewAmount);

    // Once we get the new installment amount we need to calculate the percentage
    const percentage = (installmentNewAmount * 100) / amountDueleftSubtotal;
    const newLineItems = amountDueLeft.getPercentageFromBalanceDueLineItems(percentage);

    for (let index = 0; index < billing.paymentDetail.listOfInstallments.length; index++) {
      const installment = new Installment(billing.paymentDetail.listOfInstallments[index]);
      if (installment.paid === false) {
        const originalInstallmentAmount = installment.subtotal;
        const balanceDue = await getTotalBalanceDue(billing.pk, billing.effectiveDate);
        const totalPremiumDue = balanceDue.getTotalPremiums();
        installment.clearLineItems();
        installment.addLineItems(newLineItems.lineItems);
        installment.installmentFee = getInstallmentFee(totalPremiumDue);
        if (installment.invoiceCreated === true) {
          // We need to fetch the open invoice so we can apply credit
          // TODO: If at some point we have multiple invoices for one installment we need to change this to an array
          const invoice = openInvoices.find((elem) => elem.installmentNumber === installment.installmentNumber);
          if (invoice) {
            const amountToApply = evenRound(originalInstallmentAmount - newLineItems.subtotal, 2);
            invoice.applyToInvoiceLineItems(amountToApply);
            // We dont need to update anything else as we dont expect this invoice to be fully paid
            await billingRepo.saveInvoice(invoice);
          }
        }
        logTrace(loggerInfo, '🚀', 'recalculateInstallments-inside-else-for-installment', installment);

        billing.paymentDetail.listOfInstallments[index] = installment;
      }
    }

    applyRemainderToLastInstallment(billing.paymentDetail.listOfInstallments, totalDueLeftLineItms);
  }
};

/**
 * Gets the initial list of installments.
 * @param installmentFee
 * @param dueDate
 * @param totalBalanceDueLineItems
 */
export const getListOfInstallmentsPrePolicyPayment = (
  installmentFee: number,
  effectiveDate: string,
  totalBalanceDueLineItems: LineItems,
  addLineItemInstallmentFee: boolean = false
) => {
  const listOfInstallments = new Array<Installment>();

  const firstInstallment = new Installment();
  firstInstallment.installmentNumber = 1;
  firstInstallment.paid = false;
  firstInstallment.invoiceCreated = false;
  firstInstallment.dueDate = formatISO(new Date(), { representation: 'date' });
  firstInstallment.installmentFee = 0;

  let installmentsSubtotal = 0;
  // We add all taxes and fees and the 16.7% of the Premiums
  for (const lineItem of totalBalanceDueLineItems.lineItems) {
    if (lineItem.itemType === LineItem.ItemType.Premium) {
      const premiumRounded = evenRound(lineItem.amount * 0.167, 2);
      firstInstallment.addLineItem(
        new LineItem({
          amount: premiumRounded,
          itemType: lineItem.itemType,
          account: lineItem.account,
          writingCompany: lineItem.writingCompany
        })
      );
    } else {
      if (lineItem.account !== LineItem.AccountType.InstallmentFee) {
        firstInstallment.addLineItem(
          new LineItem({
            amount: lineItem.amount,
            itemType: lineItem.itemType,
            account: lineItem.account,
            writingCompany: lineItem.writingCompany
          })
        );
      }
    }
  }

  installmentsSubtotal += firstInstallment.subtotal;

  listOfInstallments.push(firstInstallment);
  // Starting index at 1 because we only need 10 installments created and it matches the installment number +1
  for (let index = 1; index < 11; index++) {
    const installment = new Installment();

    effectiveDate = formatISO(addDays(parseISO(effectiveDate), 30), { representation: 'date' });
    installment.installmentNumber = index + 1;
    installment.paid = false;
    installment.invoiceCreated = false;
    installment.dueDate = effectiveDate;
    installment.installmentFee = installmentFee;

    // We add the 8.33% of the Premiums
    for (const lineItem of totalBalanceDueLineItems.lineItems) {
      if (lineItem.itemType === LineItem.ItemType.Premium) {
        const premiumRounded = evenRound(lineItem.amount * 0.0833, 2);
        installment.addLineItem(
          new LineItem({
            amount: premiumRounded,
            itemType: lineItem.itemType,
            account: lineItem.account,
            writingCompany: lineItem.writingCompany
          })
        );
      }
    }

    if (addLineItemInstallmentFee) {
      installment.addLineItem(
        new LineItem({
          amount: installmentFee,
          itemType: LineItem.ItemType.Fee,
          account: LineItem.AccountType.InstallmentFee
        })
      );
    }

    listOfInstallments.push(installment);
  }

  applyRemainderToLastInstallment(listOfInstallments, totalBalanceDueLineItems);

  return listOfInstallments;
};

/**
 * Add remainder to the last installment to prevent rounding issuese
 * @param installments
 * @param amountDueleftSubtotal
 */
export const applyRemainderToLastInstallment = (installments: Array<Installment>, totalLeftLineItems: LineItems) => {
  const unpaidInstallmentsLineItem = new LineItems();
  // In order to prevent rounding issues we have to iterate through the installments and compare that with the amount due left on the policy
  for (const installment of installments) {
    if (installment.paid === false) {
      unpaidInstallmentsLineItem.addLineItems(installment.lineItems);
    }
  }

  const differenceLineItems = new LineItems();

  for (const lineItem of totalLeftLineItems.lineItems) {
    const tempLineItem = unpaidInstallmentsLineItem.lineItems.find(
      (unpaidLineItem) => lineItem.account === unpaidLineItem.account && lineItem.itemType === unpaidLineItem.itemType
    );

    if (tempLineItem) {
      const difference = evenRound(lineItem.amount - tempLineItem.amount, 2);

      differenceLineItems.addLineItem(
        new LineItem({
          amount: difference,
          itemType: lineItem.itemType,
          account: lineItem.account,
          writingCompany: lineItem.writingCompany
        })
      );
    }
  }
  // If the difference subtotal is different than 0 we need to apply that to the last installment
  if (differenceLineItems.subtotal !== 0) {
    // We try to apply the difference to the last installment of the list
    // There is no scenario where this installment hasn't been paid and we are trying to decrease the installment amounts
    const lastInstallmentIndex = installments.length - 1;

    if (installments[lastInstallmentIndex].paid === false) {
      installments[lastInstallmentIndex].addLineItems(differenceLineItems.lineItems);
    }
  }
};
