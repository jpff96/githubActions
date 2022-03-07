require('dotenv').config();
import { IMigrate, MigrateBase } from '@eclipsetechnology/migrationlibrary';
import { DocumentClient, ScanInput, ScanOutput } from 'aws-sdk/clients/dynamodb';
import { Billing } from '../../../handlers/accounting/v1/models/Billing';


/**
 * Billing Migration
 * @class BillingMigrate
 */
export class BillingMigrate extends MigrateBase implements IMigrate {
  /**
   * Initializes a new instance of the @see BillingMigrate class.
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

    await this.setAgencyEntityId();
    success = true;

    return success;
  };

  /**
   * Set agency entity id to billing
   */
  private setAgencyEntityId = async () => {
    const params = {
      TableName: this.tableName,
      ExpressionAttributeValues: {
        ':sk': 'Main'
      },
      ExpressionAttributeNames: {
        '#sk': 'sk'
      },
      FilterExpression: '#sk = :sk'
    } as ScanInput;

    let scanResult: ScanOutput;

    do {
      scanResult = await this.dynamoClient.scan(params).promise();

      for (const item of scanResult.Items) {
        const billing = item as unknown as Billing;

        // At this time, the agency entity id is the same as the entity id.
        billing.agencyEntityId = billing.ownerEntityId;
        await this.saveBillingChanges(billing);
      }

      params.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);
  };

  /**
   * Saves the changes into the billing
   * @param billing the billing to be updated
   */
  private saveBillingChanges = async (billing: Billing) => {
    const params = {
      TableName: this.tableName,
      Item: billing
    };

    await this.dynamoClient.put(params).promise();
  };
}
