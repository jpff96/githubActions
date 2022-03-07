///////////////////////////////////////////////////////////////////////////////////////////////////
export enum paymentResultType {
  None = 0,
  SUCCESS = 1,
  BLOCKED = 2,
  DECLINED = 3,
  FAILED = 4
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export enum refundResultType {
  None = 0,
  SUCCESS = 1,
  FAILED = 2
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export enum PaymentTypes {
  None = 0,
  CREDIT_CARD = 'Credit Card',
  ACH = 2,
  ECHECK = 'ECheck',
  CHECK = 'Check'
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export enum accountType {
  None = 0,
  CHECKING = 1,
  SAVINGS = 2
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export enum paymentActivityType {
  None = 0,
  PAYMENT = 1,
  REFUND = 2
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export enum providers {
  None = 'None',
  Bill2Pay = 'Bill2Pay',
  Lockbox = 'Lockbox',
  VPay = 'VPay'
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export enum cardType {
  None = 0,
  VISA = 1,
  MASTER_CARD = 2,
  AMEX = 3
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export enum b2pProductNames {
  Openhouse = 'Choice Florida'
}

///////////////////////////////////////////////////////////////////////////////////////////////////
export enum productNames {
  OpenHouse = 'OpenHouse Choice Florida'
}

export enum documentType {
  None = 0,
  Application = 1,
  Quote = 2,
  Declaration = 3,
  Invoice = 4,
  Receipt = 5,
  FirstNoticeOfLoss = 6,
  ClaimAssignment = 7
}

// Used for database range/sort key
export enum AccountingDocType {
  Charge = 'CHRG',
  Payment = 'PMNT',
  Totals = 'TOTALS'
}

export enum AccountingPolicyType {
  Companion = 'C',
  Main = 'M'
}

export enum BalanceRecordType {
  MainBalanceDue = 'MainBalanceDue',
  CompanionBalanceDue = 'CompanionBalanceDue',
  Refund = 'Refund',
  CompanionRefund = 'CompanionRefund',
  InstallmentFee = 'Installment Fee',
  ProviderFee = 'Provider Fee',
  Reinstatement = 'Reinstatement',
  Nsf = 'NSF',
  CompanionCancellation = 'CompanionCancellation',
  Cancellation = 'Cancellation',
  WriteOff = 'WriteOff'
}

export enum TimeZoneType {
  AmericaChicago = 'America/Chicago',
  AmericaNewYork = 'America/New_York'
}

export enum LocaleType {
  En_u_hc_h23 = 'en-u-hc-h23'
}

export enum CountryCodeType {
  Usa = 'USA'
}

export enum CurrencyType {
  Usd = 'USD'
}

export enum RecipientPartyType {
  Business = 'Business',
  Consumer = 'Consumer'
}

export enum TaxIdType {
  EIN = 'EIN',
  SSN = 'SSN'
}

export enum VPayBooleanType {
  Yes = 'Y',
  No = 'N'
}

export enum VPayRecordNumberType {
  RecordNumber = '1'
}

export enum VPayOriginType {
  Semed = 'SEMED'
}

export enum VPayPartiesDisagreeType {
  Mpc = 'MPC'
}

export enum VPayPartyType {
  Business = 'B',
  Consumer = 'C'
}

export enum VPayPayeeViableType {
  Viable = 'V',
  No = 'N'
}

export enum VPayPaymentRequestType {
  Default = 'DEFAULT'
}

export enum VPayPreferredContactMethodType {
  Default = 'D'
}

export enum VPayPreferredDocDistributionMethodType {
  Default = 'DEFAULT'
}

export enum VPayRecordType {
  Header = 'HR000',
  Payment = 'VR001',
  Party = 'VR002',
  Reference = 'VR003',
  Trailer = 'TR999'
}

export enum VPayRemitMethodType {
  None = 'NONE',
  Pdf = 'PDF'
}

export enum VPayTimeoutOutcomeType {
  Mpc = 'MPC'
}

export enum VPayTpaType {
  Fim = 'FIM'
}

export enum VPayVersionType {
  Version = '0000'
}

export enum referenceType {
  Policy = 'POLICY'
}

export enum BufferEncodingTypes {
  Base64 = 'base64',
  Utf8 = 'utf-8'
}

export enum FileExtension {
  Txt = 'txt'
}

export enum CostType {
  ClaimCost = 'ClaimCost',
  CompanionDeductible = 'CompanionDeductible',
  ExpenseAdjustingAndOther = 'ExpenseAdjustingAndOther', // Expense - A&O: Adjusting & Other
  ExpenseDefenseAndCostContainment = 'ExpenseDefenseAndCostContainment', // Expense - D&CC: Defense & Cost containment
  PremiumRefund = 'PremiumRefund',
  ZeroPayment = 'ZeroPayment'
}

export enum Reasons {
  Overpayment = 'OverPayment',
  Cancellation = 'Cancellation',
  PolicyChange = 'PolicyChange',
  Suspense = 'Suspense',
  PolicyRescinded = 'PolicyRescinded',
  RefundedCheck = 'RefundedCheck',
  Other = 'Other'
}

export enum CatastropheType {
  TropicalStorm = 'TropicalStorm',
  Hurricane = 'Hurricane',
  NonHurricaneWind = 'NonHurricaneWind',
  Hail = 'Hail',
  Flood = 'Flood',
  Other = 'Other'
}

export enum DeliveryMethodType {
  Overnight = 'Overnight',
  Standard = 'Standard',
  Certified = 'Certified'
}

export enum PaymentDetailType {
  CompanionDeductible = 'CompanionDeductible',
  Deductible = 'Deductible',
  LossAmount = 'LossAmount',
  RecoverableDepreciationWithheld = 'RecoverableDepreciationWithheld',
  RecoverableDepreciationPaid = 'RecoverableDepreciationPaid'
}

export enum GovernmentIdType {
  TIN = 'TIN'
}

export enum GovernmentIdNumber {
  DummyNumber = '00-0000000'
}

export enum Bill2PayPaymentSources {
  PORTAL = 'Portal',
  WEB = 'Web'
}

export enum Bill2PayResultCodes {
  OK = 200
}

export enum ESEventType {
  Remove = 'REMOVE'
}

export enum DynamoDBComparators {
  Equal = '=',
  NotEqual = '<>',
  LessThan = '<',
  LessEqualThan = '<=',
  GreaterThan = '>',
  GreaterEqualThan = '>='
}

export enum StreamTable {
  Balance = 'balance',
  Lockbox = 'lockbox'
}

export enum QueueType {
  OutOfBalance = 'OutOfBalance'
}
