import { InstallmentObject } from './InstallmentObject';

export class PaymentInformationResponse {
  acceptCreditCards: boolean = false;
  acceptEChecks: boolean = false;
  creditCardFee: number = 0;
  eCheckFee: number = 0;
  providerResultCode: number = 0;
  transactionToken: string = '';
  provider: string = "";
  resultCode: number = 200;
  resultMessage: string = "";
  installment: InstallmentObject;

  constructor() {}
}
