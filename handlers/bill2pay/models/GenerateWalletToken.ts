export class GenerateWalletToken {
    allowCreditCard: boolean;
    allowECheck: boolean;
    redirectHref: string;
    customerId: string;
  
    constructor(data?: any) {
      if (data) {
        this.allowCreditCard = data.allowCreditCard || true;
        this.allowECheck = data.allowECheck || true;
        this.redirectHref = data.redirectHref;
        this.customerId = data.customerId || '0001234';
      }
    }
  }
  