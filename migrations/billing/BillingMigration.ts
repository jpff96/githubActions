import { IMigration } from '@eclipsetechnology/migrationlibrary';
import { KeyValueDefaults } from '@eclipsetechnology/migrationlibrary/dist/Const';
import { V1BillingMigrate } from './v1';
import { BillingSeed } from './BillingSeed';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

/**
 * Billing table migration
 * @class BillingMigration
 */
export class BillingMigration implements IMigration {
  private dynamoClient: any;
  private tableName: string;
  private stage: string;

  private pkValue: string = KeyValueDefaults.PK;
  private skValue: string = KeyValueDefaults.SK;

  /**
   * Initializes a new instance of the @see BillingMigration class.
   * @param dynamoClient
   * @param tableName
   * @param stage
   */
  constructor(dynamoClient: DocumentClient, tableName: string, stage: string) {
    this.dynamoClient = dynamoClient;
    this.tableName = tableName;
    this.stage = stage;
  }

  /**
   * Migrate to the specified version
   * @param version
   * @returns The next version on success, on failure either an exception will be thrown, or the same version number
   */
  migrate = async (version: number): Promise<boolean> => {
    console.log(`Migrate Billing Version ${version}`);
    let success = false;

    switch (version) {
      case 1:
        const v1Migrate = new V1BillingMigrate(this.dynamoClient, this.tableName);
        success = await v1Migrate.up();
        break;

      default:
        console.log(`No Billing migration defined for version ${version}`);
    }

    return success;
  };

  /**
   * Adjust the seed data
   *
   * Note: Seed data should only impact missing data.  If a record already exists, it needs to be left alone. As Todd says "must be idempotent"
   *
   * @returns
   */
  seed = async (version: number): Promise<boolean> => {
    console.log(`Seed Billing Version ${version}`);

    const seed = new BillingSeed(this.dynamoClient, this.tableName, this.stage);

    const success = await seed.seed('../seed');

    return success;
  };

  /**
   * Load the VERSION record for this Database
   *
   * @returns
   */
  loadDBVersion = async (): Promise<number> => {
    let dbVersion: number = 0;

    const getParams = {
      TableName: this.tableName,
      Key: {
        pk: this.pkValue,
        sk: this.skValue
      }
    };

    const res = await this.dynamoClient.get(getParams).promise();
    if (res?.Item) {
      dbVersion = res.Item.current;
    }

    return dbVersion;
  };

  /**
   * Update the VERSION record to indicate its current version
   *
   * @param currentVersion
   * @returns
   */
  updateDBVersion = async (currentVersion: number): Promise<boolean> => {
    const parameters = {
      TableName: this.tableName,
      Key: {
        pk: this.pkValue,
        sk: this.skValue
      },
      UpdateExpression: 'SET #current = :current',
      ExpressionAttributeValues: {
        ':current': currentVersion
      },
      ExpressionAttributeNames: {
        '#current': 'current'
      },
      ReturnValues: 'ALL_NEW'
    };

    await this.dynamoClient.update(parameters).promise();

    return true;
  };
}
