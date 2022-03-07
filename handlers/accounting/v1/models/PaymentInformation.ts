import { PaymentTypes } from '../../../../libs/enumLib';
import { getPaymentType } from '../../../../libs/Utils';

export class PaymentInformation {
  confirmationNumber: string;
  paymentType: PaymentTypes;
  amountPaid: number;
  authCode: string;
  providerFee: number;
  transactionDateTime: string;
  paymentMethod: string;

  constructor(data?: any) {
    if (data) {
      this.confirmationNumber = data.confirmationNumber;
      this.paymentType = getPaymentType(data.paymentType);
      this.authCode = data.authCode;
      this.amountPaid = data.amount;
      this.providerFee = data.fee;
      this.transactionDateTime = data.transactionDateTime;
      this.paymentMethod = data.paymentMethod;
    }
  }
}
