export class CartItem {
  // Naming convention based on Bill2Pay API
  Amount: number;
  AccountNumber1: string;
  AccountNumber2: string;
  AccountNumber3: string;
  ProductName: string;

  constructor(data?: any) {
    if (data) {
      this.Amount = data.Amount;
      this.AccountNumber1 = data.AccountNumber1;
      this.AccountNumber2 = data.AccountNumber2;
      this.AccountNumber3 = data.AccountNumber3;
      this.ProductName = data.ProductName;
    }
  }
}