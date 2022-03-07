export class WalletResponse {
  acceptCreditCards: boolean = false;
  acceptEChecks: boolean = false;
  transactionToken: string = '';
  provider: string = "";
  resultCode: number = 200;
  resultMessage: string = "";

  constructor() {}
}
