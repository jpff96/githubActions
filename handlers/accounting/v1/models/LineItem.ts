/**
 * LineItem
 */
export class LineItem {
  amount: number = 0;
  itemType: LineItem.ItemType = LineItem.ItemType.Premium;
  account: LineItem.AccountType = LineItem.AccountType.Main;
  writingCompany: string = '';

  /**
   * Initializes a new instance of the @see LineItem class.
   * @param data Data to create the object
   */
  constructor(data?: any) {
    if (data) {
      this.amount = data.amount;
      this.itemType = data.itemType;
      this.account = data.account;
      this.writingCompany = data.writingCompany;
    }
  }

  /**
   * Creates a new LineItem instance
   * @param amount
   * @param itemType
   * @param account
   * @param writingCompany
   * @returns
   */
  public static create(
    amount: number,
    itemType: LineItem.ItemType,
    account: LineItem.AccountType,
    writingCompany: string
  ) {
    return new LineItem({
      amount,
      itemType,
      account,
      writingCompany
    });
  }
}

export namespace LineItem {
  /**
   * Line item types
   */
  export enum ItemType {
    Premium = 'Premium',
    Fee = 'Fee',
    Tax = 'Tax'
  }

  /**
   * Account types
   * Order below used to sort items in the payment by account type
   *    Late Fee, NSF Fee, Installment Fee, Reinstatement Fee
   *    Smart deductible fees(policy)
   *    Home policy fees (empa, policy)
   *    Smart deductible taxes(DFS, FSLSO)
   *    Smart deductible premium
   *    Home policy premium
   */
  export enum AccountType {
    NsfFee = 'NsfFee',
    InstallmentFee = 'InstallmentFee',
    CompanionPolicyFee = 'CompanionPolicyFee',
    MainPolicyFee = 'MainPolicyFee',
    EMPA = 'EMPA',
    EmergencyFIGA = 'EmergencyFIGA',
    CPIC = 'CPIC',
    EmergencyCPIC = 'EmergencyCPIC',
    FIGA = 'FIGA',
    DFS = 'DFS',
    FSLSO = 'FSLSO',
    Companion = 'Companion',
    Main = 'Main'
  }
}
