import { safeTrim } from '@eclipsetechnology/eclipse-api-helpers';

/**
 * Address
 * @class Address
 */
export class Address {
  city: string;
  countryCode?: string;
  county?: string;
  countyFIPS?: string;
  line1: string;
  line2?: string;
  postalCode: string;
  state: string;
  stateCode?: string;

  /**
   * Initializes a new instance of the Address class.
   * @param src Source to create new address record from.
   */
  constructor(data?: any) {
    this.loadFromSource(data);
  }

  /**
   * Load model from record or source snippet
   *
   * @param src
   */
  loadFromSource = (src?: any) => {
    if (src) {
      this.city = safeTrim(src.city);
      this.countryCode = safeTrim(src.countryCode);
      this.county = safeTrim(src.county);
      this.countyFIPS = safeTrim(src.countyFIPS);
      this.line1 = safeTrim(src.line1);
      this.line2 = safeTrim(src.line2);
      this.postalCode = safeTrim(src.postalCode);
      this.state = safeTrim(src.state);
      this.stateCode = safeTrim(src.stateCode);
    }
  };
}
