import * as math from 'mathjs';
import { LineItem } from './LineItem';
import { LineItems } from './LineItems';

/**
 * This class sends the payment info to policyAPI to be able to request all insured data from PolicyAPI
 * @class PremiumRefund
 */
export class PremiumRefund extends LineItems {
  policyNumber: string;


  constructor(data?: any) {
    super(data);
    if (data) {
      this.policyNumber = data.policyNumber;
    }
  }
}