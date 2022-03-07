import { IMigrate, MigrateBase } from '@eclipsetechnology/migrationlibrary';
import { DocumentClient, ScanInput, ScanOutput } from 'aws-sdk/clients/dynamodb';
import { AttributeMap } from '../../../handlers/accounting/v1/models/AttributeMap';
import { BalanceTotal } from '../../../handlers/accounting/v1/models/BalanceTotal';
import { LineItems } from '../../../handlers/accounting/v1/models/LineItems';
import { AccountingDocType } from '../../../libs/enumLib';

/**
 * Balance Migration
 * @class BalanceMigrate
 */
export class BalanceMigrate extends MigrateBase implements IMigrate {
  private stage: string;

  /**
   * Initializes a new instance of the @see BalanceMigrate class.
   * @param dynamoClient
   * @param tableName
   */
  constructor(dynamoClient: DocumentClient, tableName: string, stage: string) {
    super(dynamoClient, tableName);
    this.stage = stage;
  }

  /**
   * Up
   * @returns
   */
  up = async (): Promise<boolean> => {
    let success = false;

    await this.updateTotalValues();

    success = true;

    return success;
  };

  /**
   * Set the balance table totals to individual attributes by account rather
   * than the line items list that was there.
   */
  private updateTotalValues = async () => {
    const params = {
      TableName: this.tableName
    } as ScanInput;

    const client = this.dynamoClient as DocumentClient;
    let scanResult: ScanOutput;

    do {
      scanResult = await client.scan(params).promise();

      for (const transaction of scanResult.Items) {
        const typeDate: string = transaction.typeDate as string;

        if (typeDate.startsWith('TOTALS')) {
          this.updateTotalStructure(transaction);

          // Save the updated record
          await this.save(transaction);
        } else {
          await this.updateTermDates(transaction, client);
          await this.updateTermTotals(transaction);
        }
      }

      params.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);
  };

  /**
   * Set the balance table term values.
   * @param transaction Balance transaction
   * @param client Dynamo client
   */
  private updateTermDates = async (transaction: any, client: DocumentClient) => {
    if (!transaction.termEffectiveDate) {
      // get billing record effective date
      const params = {
        TableName: `${this.stage}.solstice-api.accounting.billing`,
        Key: {
          pk: transaction.policyId,
          sk: 'Main'
        },
        ProjectionExpression: 'effectiveDate'
      } as DocumentClient.GetItemInput;

      transaction.termEffectiveDate = (await client.get(params).promise()).Item?.effectiveDate;
      await this.save(transaction);
    }
  };

  /**
   * Set the balance table term totals.
   * @param transaction Balance transaction
   */
  private updateTermTotals = async (transaction: any) => {
    if (transaction.termEffectiveDate) {
      let prefix = BalanceTotal.Prefix.BalanceDue;
      const isBalance = transaction.balanceDue ? true : false;
      const diff = new LineItems();

      if (transaction.payment) {
        prefix = BalanceTotal.Prefix.Payment;

        if (Array.isArray(transaction.payment.details) === true) {
          for (const detail of transaction.payment.details) {
            diff.addLineItems(detail.lineItems);
          }
        }
      } else if (transaction.balanceDue) {
        diff.addLineItems(transaction.balanceDue.lineItems);
      }

      if (diff.subtotal !== 0) {
        const items = diff.lineItems.reduce((subtotals, item) => {
          return {
            ...subtotals,
            [`${prefix}${item.account}`]: item.amount
          };
        }, {});

        await this.updateTotals(
          transaction.policyId,
          diff.subtotal,
          items,
          isBalance,
          1,
          transaction.termEffectiveDate
        );
      }
    }
  };

  /**
   * Modifies the totals record to remove line items and set attributes.
   * @param transaction The totals transaction to modify.
   */
  private updateTotalStructure = (transaction) => {
    // Payment line items
    if (transaction['totalPaymentLineItems']) {
      const lineItems: any = transaction['totalPaymentLineItems'];

      if (!transaction['paymentSubtotals']) {
        transaction['paymentSubtotals'] = {};
      }

      for (const lineItem of lineItems) {
        transaction['paymentSubtotals'][lineItem.account] = lineItem.amount;
      }

      delete transaction['totalPaymentLineItems'];
    }

    // Balance due line items
    if (transaction['totalBalanceDueLineItems']) {
      const lineItems: any = transaction['totalBalanceDueLineItems'];

      if (!transaction['balanceDueSubtotals']) {
        transaction['balanceDueSubtotals'] = {};
      }

      for (const lineItem of lineItems) {
        transaction['balanceDueSubtotals'][lineItem.account] = lineItem.amount;
      }

      delete transaction['totalBalanceDueLineItems'];
    }
  };

  /**
   * Updates the totals record for the policy
   * @param policyId The policy.
   * @param amount The total amount to add.
   * @param items Breakdown of total values by account.
   * @param isBalance True for a balance total update, otherwise false.
   * @param count The count to add. Set to 0 when trigger is a modify existing record.
   * @param termEffectiveDate Optional term effective date.
   * @returns
   */
  private async updateTotals(
    policyId: string,
    amount: number,
    items: AttributeMap,
    isBalance: boolean,
    count = 1,
    termEffectiveDate?: string
  ) {
    let params: DocumentClient.UpdateItemInput;
    let typeDate: string = AccountingDocType.Totals;

    if (termEffectiveDate) {
      typeDate += `_${termEffectiveDate}`;
    }

    if (isBalance === true) {
      params = {
        TableName: this.tableName,
        Key: {
          policyId: policyId,
          typeDate: typeDate
        },
        UpdateExpression: 'ADD #ttlBalDue :amt,#balDueCount :cnt',
        ExpressionAttributeNames: {
          '#ttlBalDue': 'totalBalanceDue',
          '#balDueCount': 'balanceDueCount'
        },
        ExpressionAttributeValues: {
          ':amt': amount,
          ':cnt': count
        }
      } as DocumentClient.UpdateItemInput;
    } else {
      params = {
        TableName: this.tableName,
        Key: {
          policyId: policyId,
          typeDate: typeDate
        },
        UpdateExpression: 'ADD #ttlPay :amt,#payCnt :cnt',
        ExpressionAttributeNames: {
          '#ttlPay': 'totalPayments',
          '#payCnt': 'paymentCount'
        },
        ExpressionAttributeValues: {
          ':amt': amount,
          ':cnt': count
        }
      } as DocumentClient.UpdateItemInput;
    }

    // Build name/value pairs and add to the update expression.
    for (const name of Object.getOwnPropertyNames(items)) {
      params.ExpressionAttributeNames['#' + name] = name;
      params.ExpressionAttributeValues[':' + name] = items[name];
      params.UpdateExpression += `,#${name} :${name}`;
    }

    const client = this.dynamoClient as DocumentClient;
    await client.update(params).promise();
  }
}
