import { PaymentDetailType } from '../../../../libs/enumLib';

/**
 * Information used to represent a payment detail
 */
export class PaymentDetail {
  amount: number;
  coverageType: string;
  type: PaymentDetailType;

  /**
   * Initializes a new instance of the PaymentDetail class.
   * @param src Source to create new PaymentDetail record from.
   */
  constructor(src?: any) {
    this.loadFromSource(src);
  }

  loadFromSource = (src?: any) => {
    if (src) {
      this.amount = src.amount;
      this.coverageType = src.coverageType;
      this.type = src.type;
    }
  };
}
