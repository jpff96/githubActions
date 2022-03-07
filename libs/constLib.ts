export const Configuration = {
  API_SIG: 'Solstice-Payment-API'
};

export const ErrorCodes = {
  MORTGAGEE_BILLING: 100,
  MORTGAGEE_LIST: 200,
  SCHEDULE: 300,
  REFUND: 400,
  PAYMENT: 500
};

export const PaymentActivityType = {
  PAYMENT: 'Payment',
  REFUND: 'Refund'
};

export const PaymentSource = {
  PORTAL: 'Portal'
};

export const PaymentTypeDescription = {
  CREDIT_CARD: 'Credit Card',
  ACH: 'ACH',
  ECHECK: 'eCheck'
};

export const AccountType = {
  NONE: 'NONE',
  CHECKING: 'CHECKING',
  SAVINGS: 'SAVINGS'
};

export const AccountTypeDescription = {
  NONE: 'NONE',
  CHECKING: 'Checking',
  SAVINGS: 'Savings'
};

export const DocType = {
  Policy: 'Policy',
  Detail: 'Detail',
  All: 'All'
};

export const MortgageeBillingProviderType = {
  MOCK: 'MOCK',
  LEXIS_NEXIS: 'LEXISNEXIS'
};

export const MortgageeListProviderType = {
  MOCK: 'MOCK'
};

export const PaymentProviderType = {
  MOCK: 'MOCK',
  BILL2PAY: 'BILL2PAY'
};

export const RefundProviderType = {
  MOCK: 'MOCK',
  BILL2PAY: 'BILL2PAY'
};

export const ScheduleProviderType = {
  MOCK: 'MOCK',
  BILL2PAY: 'BILL2PAY'
};

export const ScheduleType = {
  BIANNUAL: 'BIANNUAL',
  QUARTERLY: 'QUARTERLY',
  MONTHLY: 'MONTHLY'
};

export const SdeTypes = {
  PAYMENT: 'Payment',
  WALLET: 'Wallet'
};

export const VPayPaddingConfig = {
  PADDING_MAX: 10
};

export const EntityIDType = {
  SOLSTICE: '00000000-0000-0000-0000-000000000000'
};

export const PaymentNames = {
  LENDER_BILL: 'Lender Bill',
  INSURED_BILL_MONTHLY: 'Insured Bill, Monthly',
  INSURED_BILL_ANNUALLY: 'Insured Bill, Annually'
};
