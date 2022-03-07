/**
 * PaymentUserInformation
 * @class PaymentUserInformation
 */
export class PaymentUserInformation {
  providerReference: string;
  email: string;
  version: string;
  policyId: string;
  customerId: string;
  entityId: string;

  /**
   * Initializes a new instance of the @see {PaymentUserInformation} class.
   * @param src The source record.
   */
  constructor(src?: any) {
    if (src) {
      this.providerReference = src.providerReference;
      this.email = src.cognitoUserId || src.email;
      this.version = src.version;
      this.policyId = src.policyId;
      this.entityId = src.entityId;
      this.customerId = src.customerId;
    }
  }
}