import { IMigrate, MigrateBase } from '@eclipsetechnology/migrationlibrary';
import { DocumentClient, ScanInput, ScanOutput } from 'aws-sdk/clients/dynamodb';

/**
 * Balance Migration
 * @class BalanceMigrate
 */
export class BalanceMigrate extends MigrateBase implements IMigrate {
  /**
   * Initializes a new instance of the @see BalanceMigrate class.
   * @param dynamoClient
   * @param tableName
   */
  constructor(dynamoClient: DocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  /**
   * Up
   * @returns
   */
  up = async (): Promise<boolean> => {
    let success = false;

    await this.updatePaymentInvoice();

    success = true;

    return success;
  };

  /**
   * Set the payment invoice attribute
   */
  private updatePaymentInvoice = async () => {
    const params = {
      TableName: this.tableName,
      ExpressionAttributeValues: {
        ':pmnt': 'PMNT'
      },
      ExpressionAttributeNames: {
        '#payment': 'payment',
        '#type': 'type'
      },
      FilterExpression: '#payment.#type = :pmnt'
    } as ScanInput;

    const client = this.dynamoClient as DocumentClient;
    let scanResult: ScanOutput;

    do {
      scanResult = await client.scan(params).promise();

      for (const transaction of scanResult.Items) {
        const lineItems = transaction.payment['lineItems'];

        if (lineItems) {
          // Move the line items to the details attribute
          if (Array.isArray(transaction.payment['details']) === false) {
            transaction.payment['details'] = [];
          }

          transaction.payment['details'].push({
            subtotal: transaction.payment['subtotal'],
            description: transaction.payment['description'],
            invoiceNumber: null,
            lineItems: lineItems
          });
          delete transaction.payment['lineItems'];

          // Save the updated record
          await this.save(transaction);
        }
      }

      params.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);
  };
}
