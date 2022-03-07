export class PaymentWithTokenResponseModel {
    resultCodeOfTransaction: number = 0;
    confirmationNumber: string = '';
    amountPaid: number = 0;
    paymentType: string = '';
    creditCardAuthCode: string = '';
    convenienceFeeCharged: number = 0;
    transactionDateTime: string = '';
    paymentMethod: string = '';
    message: string = '';
    resultCode: number = 200;
    resultMessage: string = '';
};