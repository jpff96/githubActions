import { Address } from '../../../../models/Address';
import { RecipientPartyType, TaxIdType } from '../../../../libs/enumLib';

/**
 * @class Recipient
 */
export class Recipient {
  address: Address = new Address();
  companyName: string = '';
  email: string = '';
  firstName: string = '';
  governmentIdNumber?: string;
  governmentIdType?: TaxIdType;
  lastName: string = '';
  isDefaultRecipient: boolean = false;
  partyType: RecipientPartyType;
  phoneNumber: string = '';

  /**
   * Initializes a new instance of the @see Recipient class.
   * @param src
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
      this.address.loadFromSource(src.address);
      this.companyName = src.companyName;
      this.email = src.email;
      this.firstName = src.firstName;
      this.governmentIdNumber = src.governmentIdNumber;
      this.governmentIdType = src.governmentIdType || TaxIdType.EIN;
      this.lastName = src.lastName;
      this.isDefaultRecipient = src.isDefaultRecipient;
      this.partyType = src.partyType;
      this.phoneNumber = src.phoneNumber;
    }
  };
}
