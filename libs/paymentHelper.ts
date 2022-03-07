export const getLast4OfAccount = reqBody => {
  const { PaymentType } = require("./constLib");

  let last4 = "";

  const { paymentType } = reqBody;

  // Get raw account number from request
  let accountNumber = "";
  if (paymentType === PaymentType.CREDIT_CARD) {
    accountNumber = reqBody.creditCardInfo.accountNumber;
  } else if (paymentType === PaymentType.ECHECK) {
    accountNumber = reqBody.bankInfo.accountNumber;
  }

  if (accountNumber.length > 4) {
    last4 = accountNumber.slice(-4);
  }

  return last4;
};

export function getNameOnAccount(reqBody) {
  const { creditCardInfo, bankInfo } = reqBody;

  let nameOnAccount = "";

  if (creditCardInfo) {
    nameOnAccount = creditCardInfo.nameOnAccount;
  } else if (bankInfo) {
    nameOnAccount = bankInfo.nameOnAccount;
  }

  return nameOnAccount;
};
