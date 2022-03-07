import { DefaultPaymentMethod } from './DefaultPaymentMethod';

export class PaymentMethodResponseListModel {
  resultCode: number = 200;
  resultMessage: string = '';
  listOfMethods: Array<DefaultPaymentMethod> = [];

  constructor() { }
}
