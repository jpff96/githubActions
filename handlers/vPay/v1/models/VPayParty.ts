import {
  CountryCodeType,
  VPayBooleanType,
  VPayPayeeViableType,
  VPayPaymentRequestType,
  VPayPreferredContactMethodType,
  VPayPreferredDocDistributionMethodType,
  VPayRecordType
} from '../../../../libs/enumLib';

/**
 * Information used to represent claim scheduled party
 */
export class VPayParty {
  readonly recordType: string = VPayRecordType.Party;
  readonly paymentRequestType: string = VPayPaymentRequestType.Default;
  readonly endorser: string = VPayBooleanType.No;
  readonly payee: string = VPayPayeeViableType.Viable;
  readonly preferredDocDistributionMethod: string = VPayPreferredDocDistributionMethodType.Default;
  readonly preferredContactMethod: string = VPayPreferredContactMethodType.Default;

  paymentId: string;
  partyType: string;
  partyName: string;
  defaultAddress: string;
  partyAddress1: string;
  partyAddress2: string;
  partyAddress3: string;
  partyCity: string;
  partyStateOrProvince: string;
  partyCountry: string;
  partyPostalCode: string;
  governmentIdNumber: string;
  governmentIdType: string;

  /**
   * Initializes a new instance of the VPayParty class.
   * @param src Source to create new VPayParty record from.
   */
  constructor(src?: any) {
    this.loadFromSource(src);
  }

  /**
   * Load model from record or source snippet
   *
   * @param src
   */
  loadFromSource = (src?: any) => {
    if (src) {
      this.paymentId = src.paymentId;
      this.partyType = src.partyType;
      this.partyName = src.partyName;
      this.defaultAddress = src.defaultAddress;
      this.partyAddress1 = src.partyAddress1;
      this.partyAddress2 = src.partyAddress2;
      this.partyAddress3 = src.partyAddress3;
      this.partyCity = src.partyCity;
      this.partyStateOrProvince = src.partyStateOrProvince;
      this.partyCountry = src.partyCountry || CountryCodeType.Usa;
      this.partyPostalCode = src.partyPostalCode;
      this.governmentIdNumber = src.governmentIdNumber;
      this.governmentIdType = src.governmentIdType;
    }
  };
}
