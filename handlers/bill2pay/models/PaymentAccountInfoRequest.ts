import { CartItem } from './CartItem';

export class PaymentAccountInfoRequest {
  // Naming convention based on Bill2Pay API
  SdeType?: string;
  CustomerID: string;
  RequirePaymentMethod: boolean;
  AllowCreditCard: boolean;
  AllowECheck: boolean;
  RedirectUrl: string;
  paymentMethodToken?: string;
  PaymentSource?: string;
  CartItems: CartItem[];

  constructor(data?: any) {
    if (data) {
      this.RequirePaymentMethod = true;
      this.SdeType = data.sdeType || '';
      this.CustomerID = data.customerId;
      this.AllowCreditCard = data.allowCreditCard;
      this.AllowECheck = data.allowECheck;
      this.RedirectUrl = data.redirectUrl;
      this.paymentMethodToken = data.paymentMethodToken || '' ;
      this.PaymentSource = data.paymentSource || '';

      if (data.cartItems) {
        this.CartItems = data.cartItems.map(item => new CartItem(item));
      }
    }
  }
}