import { PaymentPlan } from "./PaymentPlan";

/**
 * ChangeBillingMethodRequest
 */
export class ChangeBillingMethodRequest {
  policyId: string;
  paymentPlan: PaymentPlan.PaymentPlanType;
  responsibleParty: PaymentPlan.ResponsibleParty;

  /**
   * Initializes a new instance of the @see ChangeBillingMethodRequest class.
   * @param data Data to create the object
   */
  constructor(data?: any) {
    if (data) {
      this.policyId = data.policyId;
      this.paymentPlan = data.paymentPlan;
      this.responsibleParty = data.responsibleParty;
    }
  }
}
