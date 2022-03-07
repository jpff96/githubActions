import { CartItem } from './CartItem';

export class MethodTokenAccountInfoRequest {
  // Naming convention based on Bill2Pay API
  PaymentToken: string;
  CustomerID: string;
  AllowCreditCard: boolean;
  AllowECheck: boolean;
  PaymentSource: string;
  RedirectUrl: string;
  CartItems: CartItem[];

  constructor(data?: any) {
    if (data) {
      this.PaymentToken = data.paymentMethodToken;
      this.CustomerID = data.customerId;
      this.AllowCreditCard = data.allowCreditCard;
      this.AllowECheck = data.allowECheck;
      this.PaymentSource = data.paymentSource;
      this.RedirectUrl = data.redirectUrl;
      this.CartItems = data.cartItems.map(item => new CartItem(item));

    }
  }
}