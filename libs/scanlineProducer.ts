import { Invoice } from '../handlers/accounting/v1/models/Invoice';

/**
 * Creates scanline.
 * @param invoice The invoice.
 */
export const scanline = (invoice: Invoice): string => {
  const { policyNumber, invoiceNumber, amountDue, dueDate } = invoice;

  const parsedPolicyNumber = policyNumber.toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const parsedInvoiceNumber = invoiceNumber.toUpperCase().replace(/[^A-Z0-9]+/g, '').padStart(10, '0');
  const parsedAmountDue = amountDue.toString().replace(/[^0-9]+/g, '').padStart(10, '0');
  const parsedDueDate = dueDate.replace(/[^0-9]+/g, '');

  // TODO: Add this hardcoded values to the product config
  const filler = '00';
  const lastDigit = 'M';

  const scanline = `${parsedPolicyNumber}${filler}${parsedInvoiceNumber}${filler}${parsedAmountDue}${filler}${parsedDueDate}${lastDigit}`;
  const digit = checkDigit(scanline);

  return `${scanline}${digit}`;
}

/**
 * Gets check digit.
 * @param scanline The scanline.
 */
const checkDigit = (scanline: string): number => {
  let sumDigits = 0;

  for (let i = 0; i < scanline.length; i++) {
    // Replace alpha values
    const digit = scanline.charAt(i);
    let numberDigit = Number(digit);
    if (isNaN(numberDigit)) {
      numberDigit = digitWeight(digit);
    }

    // Apply weights
    if (i % 2 !== 0) {
      numberDigit = numberDigit * 2;
    }

    // Digit addition
    if (numberDigit > 9) {
      numberDigit = numberDigit.toString().split('').map(Number).reduce((a, b) => a + b, 0);
    }

    sumDigits += numberDigit;
  }

  let checkDigit = sumDigits % 10;
  if (checkDigit !== 0) {
    checkDigit = 10 - checkDigit;
  }

  return checkDigit;
}

/**
 * Gets digit weight.
 * @param digit The digit.
 */
const digitWeight = (digit: string): number => {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return abc.indexOf(digit) + 1;
}
