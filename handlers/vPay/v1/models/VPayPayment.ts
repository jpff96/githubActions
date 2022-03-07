import {
  CountryCodeType,
  CurrencyType,
  VPayBooleanType,
  VPayPartiesDisagreeType,
  VPayRecordType,
  VPayTimeoutOutcomeType
} from '../../../../libs/enumLib';

/**
 * Information used to represent claim scheduled payment
 */
export class VPayPayment {
  readonly recordType: string = VPayRecordType.Payment;
  readonly paymentCurrency: string = CurrencyType.Usd;
  readonly timeoutOutcome: string = VPayTimeoutOutcomeType.Mpc;
  readonly partiesDisagree: string = VPayPartiesDisagreeType.Mpc;
  readonly mepEligible: string = VPayBooleanType.No;

  paymentId: string;
  clientReferenceId: string;
  payerIdOrFundingAccountCode: string;
  payerDateTime: string;
  paymentAmount: string;
  remitMethod: string;
  partyCount: string;
  shippingName: string;
  shippingAddress1: string;
  shippingAddress2: string;
  shippingAddress3: string;
  shippingCity: string;
  shippingStateOrProvince: string;
  shippingCountry: string;
  shippingPostalCode: string;
  numberOfAttachedPdfFiles: number;

  /**
   * Initializes a new instance of the VPayPayment class.
   * @param data Source to create new VPayPayment record from.
   */
  constructor(data?: any) {
    this.loadFromSource(data);
  }

  /**
   * Load model from record or source snippet
   *
   * @param src
   */
  loadFromSource = (source?: any) => {
    if (source) {
      this.paymentId = source.paymentId;
      this.clientReferenceId = source.clientReferenceId;
      this.payerIdOrFundingAccountCode = source.payerIdOrFundingAccountCode;
      this.payerDateTime = source.payerDateTime;
      this.paymentAmount = source.paymentAmount;
      this.remitMethod = source.remitMethod;
      this.partyCount = source.partyCount;
      this.shippingName = source.shippingName;
      this.shippingAddress1 = source.shippingAddress1;
      this.shippingAddress2 = source.shippingAddress2;
      this.shippingAddress3 = source.shippingAddress3;
      this.shippingCity = source.shippingCity;
      this.shippingStateOrProvince = source.shippingStateOrProvince;
      this.shippingCountry = source.shippingCountry || CountryCodeType.Usa;
      this.shippingPostalCode = source.shippingPostalCode;
      this.numberOfAttachedPdfFiles = source.numberOfAttachedPdfFiles;
    }
  };
}
