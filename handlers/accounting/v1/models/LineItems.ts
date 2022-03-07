import * as math from 'mathjs';
import { evenRound } from '../../../bill2pay/bill2Pay';
import { LineItem } from './LineItem';

/**
 * LineItems
 */
export class LineItems {
  subtotal: number = 0;
  description: string = '';
  invoiceNumber?: string;
  readonly lineItems: Array<LineItem> = new Array<LineItem>();

  /**
   * Initializes a new instance of the @see LineItems class.
   * @param data Data to create the object
   */
  constructor(data?: any) {
    if (data) {
      this.subtotal = data.subtotal ?? 0;
      this.description = data.description;
      this.invoiceNumber = data.invoiceNumber;
      this.lineItems = data.lineItems?.map((x) => new LineItem(x)) || new Array<LineItem>();
    }
  }

  /**
   * Adds a new line item and updates the subtotal.
   * @param lineItem Line item to add
   * @returns
   */
  addLineItem = (lineItem: LineItem) => {
    let myLineItem: LineItem;

    if (lineItem?.amount !== 0) {
      myLineItem = this.lineItems.find((x) => x.account === lineItem.account && x.itemType === lineItem.itemType);

      if (myLineItem) {
        // Add to existing line item
        myLineItem.amount = math.round(myLineItem.amount + lineItem.amount, 2);
      } else {
        // Add a new line item
        myLineItem = new LineItem();
        myLineItem.account = lineItem.account;
        myLineItem.amount = lineItem.amount;
        myLineItem.itemType = lineItem.itemType;
        myLineItem.writingCompany = lineItem.writingCompany;

        this.lineItems.push(myLineItem);
        this.sortByAccountType();
      }

      this.subtotal = math.round(this.subtotal + lineItem.amount, 2);
    }

    return this;
  };

  /**
   * Subtracts line item from this object.
   * @param lineItem List of line items to add.
   * @returns
   */
  subtractLineItem = (lineItem: LineItem) => {
    if (lineItem?.amount !== 0) {
      // Check for existing item
      const myLineItem = this.lineItems.find((x) => x.account === lineItem.account && x.itemType === lineItem.itemType);

      if (myLineItem) {
        // Add to existing line item
        myLineItem.amount = math.round(myLineItem.amount - lineItem.amount, 2);
      } else {
        // Add a new line item
        const newlineItem = new LineItem(lineItem);
        newlineItem.amount *= -1;
        this.lineItems.push(newlineItem);
        this.sortByAccountType();
      }

      this.subtotal = math.round(this.subtotal - lineItem.amount, 2);
    }

    return this;
  };

  /**
   * Merges line items into this object.
   * @param lineItems List of line items to add.
   * @returns
   */
  addLineItems = (lineItems: Array<LineItem>) => {
    for (const lineItem of lineItems) {
      if (lineItem.amount !== 0) {
        // Check for existing item
        const myLineItem = this.lineItems.find(
          (x) => x.account === lineItem.account && x.itemType === lineItem.itemType
        );

        if (myLineItem) {
          // Add to existing line item
          myLineItem.amount = math.round(myLineItem.amount + lineItem.amount, 2);
        } else {
          // Add a new line item
          const newlineItem = new LineItem(lineItem);
          this.lineItems.push(newlineItem);
        }

        this.subtotal = math.round(this.subtotal + lineItem.amount, 2);
      }
    }

    this.sortByAccountType();

    return this;
  };

  /**
   * Subtracts line items from this object.
   * @param lineItems List of line items to add.
   * @returns
   */
  subtractLineItems = (lineItems: Array<LineItem>) => {
    for (const lineItem of lineItems) {
      // Check for existing item
      const myLineItem = this.lineItems.find((x) => x.account === lineItem.account && x.itemType === lineItem.itemType);

      if (myLineItem) {
        // Add to existing line item
        myLineItem.amount = math.round(myLineItem.amount - lineItem.amount, 2);
      } else {
        // Add a new line item
        const newlineItem = new LineItem(lineItem);
        newlineItem.amount *= -1;
        this.lineItems.push(newlineItem);
      }

      this.subtotal = math.round(this.subtotal - lineItem.amount, 2);
    }

    this.sortByAccountType();

    return this;
  };

  /**
   * Clears the list of line items
   * @returns this
   */
  clearLineItems = () => {
    this.lineItems.length = 0;
    this.subtotal = 0;

    return this;
  };

  /**
   * Negates each item in the list
   * @returns this
   */
  negateLineItems = () => {
    for (const lineItem of this.lineItems) {
      lineItem.amount = -1 * lineItem.amount;
    }

    this.subtotal = -1 * this.subtotal;

    return this;
  };

  /**
   * Subtracts line items from this object limited to the amount specified.
   * @param lineItems List of line items to add.
   * @param amount Amount to be removed from the line items.
   * @returns the updated line items
   */
  subtractAmount = (lineItems: Array<LineItem>, amount: number) => {
    for (const lineItem of lineItems) {
      if (amount > 0 && lineItem.amount !== 0) {
        // We need to compare the amount we want to take with the absolute value of the line item amount
        const comparisonValue = lineItem.amount < 0 ? -1 * lineItem.amount : lineItem.amount;
        // Check for existing item
        const myLineItem = this.lineItems.find(
          (x) => x.account === lineItem.account && x.itemType === lineItem.itemType
        );

        if (myLineItem) {
          if (comparisonValue >= amount) {
            // Add to existing line item and reduce amount to 0
            myLineItem.amount = math.round(myLineItem.amount + amount, 2);
            amount = 0;
            lineItem.amount = math.round(lineItem.amount - amount, 2);
          } else {
            // else the line item amount is smaller than the amount to be reduced so we can simply reduce the entire line item amount
            // Add to existing line itemand reduce amount by what was added
            myLineItem.amount = math.round(myLineItem.amount + lineItem.amount, 2);
            amount = math.round(amount - comparisonValue, 2);
            lineItem.amount = 0;
          }
        } else {
          // Add a new line item
          const newlineItem = new LineItem(lineItem);
          newlineItem.amount *= -1;
          this.lineItems.push(newlineItem);
        }

        this.subtotal = math.round(this.subtotal - lineItem.amount, 2);
      }
    }

    this.sortByAccountType();

    return lineItems;
  };

  /**
   * Gets the premium amount of the line items
   * @param accountType Optional accountType
   * @returns The total premium amount within the line items
   */
  getTotalPremiums = (accountType?: LineItem.AccountType) => {
    let totalPremiums = 0;
    const premiums = this.lineItems.filter((elem) => {
      if (accountType) {
        return elem.account === accountType && elem.itemType === LineItem.ItemType.Premium;
      } else {
        return elem.itemType === LineItem.ItemType.Premium;
      }
    });

    for (const lineItem of premiums) {
      totalPremiums = evenRound(totalPremiums + lineItem.amount, 2);
    }
    return totalPremiums;
  };

  /**
   * Gets the fees amount of the line items
   * @param accountType Optional accountType 
   * @returns The total fees amount within the line items
   */
  getTotalFees = (accountType?: LineItem.AccountType) => {
    let totalFees = 0;
    const fees = this.lineItems.filter((elem) => {
      if (accountType) {
        return elem.account === accountType && elem.itemType === LineItem.ItemType.Fee;
      } else {
        return elem.itemType === LineItem.ItemType.Fee;
      }
    });

    for (const lineItem of fees) {
      totalFees = evenRound(totalFees + lineItem.amount, 2);
    }
    return totalFees;
  };

  /**
   * Gets the taxes amount of the line items
   * @param accountType Optional accountType
   * @returns The total taxes amount within the line items
   */
  getTotalTaxes = (accountType?: LineItem.AccountType) => {
    let totalTaxes = 0;
    const taxes = this.lineItems.filter((elem) => {
      if (accountType) {
        return elem.account === accountType && elem.itemType === LineItem.ItemType.Tax;
      } else {
        return elem.itemType === LineItem.ItemType.Tax;
      }
    });

    for (const lineItem of taxes) {
      totalTaxes += lineItem.amount;
    }
    return totalTaxes;
  };

  /**
   * Reduces the line items amount
   * @param amount The amount to reduce
   */
  reduceByAmount = (amount: number) => {
    for (const lineItem of this.lineItems) {
      if (amount !== 0) {
        let lineItemAmountReduced = 0;

        // If the amount due is greater than the amount paid we have to reduce then the line item amount will be 0
        if (amount >= lineItem.amount) {
          lineItemAmountReduced = lineItem.amount;
          amount = math.round(amount - lineItemAmountReduced, 2);
          lineItem.amount = 0;
          this.subtotal = math.round(this.subtotal - lineItemAmountReduced, 2);
        } else {
          //If not reduce whatever is available
          lineItem.amount = math.round(lineItem.amount - amount, 2);
          this.subtotal = math.round(this.subtotal - amount, 2);
          amount = 0;
        }
      }
    }
    this.sortByAccountType();
  };

  /**
   * Sorts the line items by account type using the AccountType enumeration as the sort order.
   * @returns Sorted line items
   */
  protected sortByAccountType = () => {
    const sortByObject = Object.values(LineItem.AccountType).reduce((obj, item, index) => {
      return {
        ...obj,
        [item]: index
      };
    }, {});

    return this.lineItems.sort((a, b) => sortByObject[a.account] - sortByObject[b.account]);
  };
}
