import { BalanceDue } from './BalanceDue';
import { Payment } from './Payment';

export interface IBalanceTransaction {
  policyId: string;
  typeDate: string;
  balanceDue?: BalanceDue;
  payment?: Payment;
}
