interface IPaymentInformationResponse {
  acceptCreditCards: boolean;
  acceptEChecks: boolean;
  creditCardFee: number;
  eCheckFee: number;
  providerResultCode: number;
  transactionToken: string;
}

interface IPaymentInformationResultModel {
  provider: string;
  resultCode: number;
  resultMessage: string;
  response: IPaymentInformationResponse;
  statistics: IStatistics;
}

interface IPaymentResponse {
  instanceKey: string;
  referenceKey: any;
  accountNumberLast4: string;
  accountType: number;
  amount: string;
  description: string;
  paymentType: string;
  policyId: string;
  policyNumber: string;
  receiptEmail: string;
  receiptDocumentKey: string;
  paymentSuccessful: boolean;
  receiptCreationSuccessful: boolean;
  nameOnAccount: string;
}

interface IPaymentResultModel {
  provider: string;
  resultCode: number;
  resultMessage: string;

  response: IPaymentResponse;
  statistics: IStatistics;
}

interface IStatistics {
  start: string;
  end: string;

  markStart(): void;
  markEnd(): void;
}
