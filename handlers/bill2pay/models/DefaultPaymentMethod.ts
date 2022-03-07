export class DefaultPaymentMethod {
  nickName: string;
  type: string;
  expirationDate: string;
  token: string;

  constructor(data?: any) {
    if (data) {
      this.nickName = data.nickName;
      this.type = data.type;
      //Expiration date depends on payment method: On Echeck we don't have one
      this.expirationDate = data.expirationDate || null;
      this.token = data.token;
    }
  }
}

