/**
 * Class that represents a configured Mortgagee company
 */
export class MortgageeModel {
  name: string = '';
  loanNumber: string = '';
  street: string = '';
  city: string = '';
  state: string = '';
  postalCode: string = '';

  constructor(item) {
    if (item) {
      this.name = item.name;
      this.loanNumber = item.loanNumber;
      this.street = item.street;
      this.city = item.city;
      this.state = item.state;
      this.postalCode = item.postalCode;
    }
  }
}
