import { DefaultPaymentMethod } from './DefaultPaymentMethod';

export class PaymentMethodListModel {
  last4: string;
  isFirstPayment: boolean;
  defaultPaymentMethod: DefaultPaymentMethod;

  constructor(data?: any) {
    if (data) {
      this.last4 = data.last4;
      this.defaultPaymentMethod = data.defaultPaymentMethod;
      this.isFirstPayment = data.isFirstPayment;
    } else {
      this.defaultPaymentMethod = new DefaultPaymentMethod();
    }
  }
}
