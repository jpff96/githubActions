/**
 * PaymentPlan
 * @class PaymentPlan
 */
export class PaymentPlan {
  planType: PaymentPlan.PaymentPlanType = PaymentPlan.PaymentPlanType.FullPay;
  responsibleParty: PaymentPlan.ResponsibleParty = PaymentPlan.ResponsibleParty.Insured;

  /**
   * Initializes a new instance of the @see {PaymentPlan} class.
   * @param src The source record.
   */
  constructor(src?: any) {
    if (src) {
      this.planType = src.planType;
      this.responsibleParty = src.responsibleParty;
    }
  }
}

export namespace PaymentPlan {
  /**
   * Types of payment plans supported.
   */
  export enum PaymentPlanType {
    FullPay = 'FullPay',
    ElevenPay = 'ElevenPay'
  }

  export enum ResponsibleParty {
    Insured = 'Insured',
    Mortgagee = 'Mortgagee'
  }
}
