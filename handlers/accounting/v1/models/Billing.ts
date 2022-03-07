import { PaymentMethodListModel } from '../../../bill2pay/models/PaymentMethodListModel';
import { BillingStatus } from './BillingStatus';
import { PaymentDetail } from './PaymentDetail';
import { PaymentPlan } from './PaymentPlan';
import { PaymentUserInformation } from './PaymentUserInformation';
import { MortgageeModel } from '../../../mortgageeList/v1/models/MortgageeModel';

/**
 * Billing
 * @class Billing
 */
export class Billing {
  // keys
  pk: string; // policy Id
  sk: string = 'Main';
  dueDate: string;
  cancelDate: string;
  productKey: string;
  companionNumber: string;
  // data
  cancellationDate: string;
  paymentDetail: PaymentDetail;
  paymentPlan: PaymentPlan;
  delinquencyDetail: Array<Object>;
  paymentMethod: PaymentMethodListModel;
  policyNumber: string;
  authCode: string;
  billingStatus: BillingStatus;
  accountNumber: string;
  policyEquity: number;
  ownerEntityId: string;
  effectiveDate: string;
  expirationDate: string;
  mortgagee: MortgageeModel;
  timestamp: number;
  userInformation: PaymentUserInformation;
  isStatementSent: boolean;
  agencyEntityId: string; // agency entity id of the policy 

  /**
   * Initializes a new instance of the @see {Billing} class.
   * @param src The source record.
   */
  constructor(src?: any) {
    if (src) {
      this.pk = src.policyId;
      this.sk = src.sk;
      this.agencyEntityId = src.agencyEntityId; 
      this.dueDate = src.dueDate;
      this.cancelDate = src.cancelDate;
      this.productKey = src.productKey;
      this.companionNumber = src.companionNumber;

      this.mortgagee = src.mortgagee;
      this.cancellationDate = src.cancellationDate;
      this.paymentDetail = new PaymentDetail(src.paymentDetail);
      this.delinquencyDetail = src.delinquencyDetail;
      this.paymentPlan = new PaymentPlan(src.paymentPlan);
      this.paymentMethod = src.paymentMethod;
      this.authCode = src.authCode;
      this.accountNumber = src.accountNumber;
      this.policyNumber = src.policyNumber;
      this.billingStatus = src.billingStatus;
      this.ownerEntityId = src.ownerEntityId;
      this.effectiveDate = src.effectiveDate;
      this.expirationDate = src.expirationDate;
      this.policyEquity = src.policyEquity;
      this.timestamp = src.timestamp;
      this.isStatementSent = false;
    } else {
      this.paymentDetail = new PaymentDetail();
      this.paymentPlan = new PaymentPlan();
      this.paymentMethod = new PaymentMethodListModel();
      this.billingStatus = new BillingStatus();
      this.userInformation = new PaymentUserInformation();
    }
  }
}
