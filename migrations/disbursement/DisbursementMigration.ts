import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { IMigration } from '@eclipsetechnology/migrationlibrary';
import { KeyValueDefaults } from '@eclipsetechnology/migrationlibrary/dist/Const';
import { DisbursementSeed } from './DisbursementSeed';
import { V1DisbursementMigrate } from './v1';
import { V2DisbursementMigrate } from './v2';
import { V3DisbursementMigrate } from './v3';
import { V4DisbursementMigrate } from './v4';

/**
 * Disbursement table migration
 * @class DisbursementMigration
 */
export class DisbursementMigration implements IMigration {
  private dynamoClient: any;
  private tableName: string;
  private stage: string;

  private pkValue: string = KeyValueDefaults.PK;
  private skValue: string = KeyValueDefaults.SK;

  /**
   * Initializes a new instance of the @see DisbursementMigration class.
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
    console.log(`Migrate Disbursement Version ${version}`);
    let success = false;

    switch (version) {
      case 1:
        const v1Migrate = new V1DisbursementMigrate(this.dynamoClient, this.tableName);
        success = await v1Migrate.up();
        break;

      case 2:
        const v2Migrate = new V2DisbursementMigrate(this.dynamoClient, this.tableName);
        success = await v2Migrate.up();
        break;

      case 3:
        const v3Migrate = new V3DisbursementMigrate(this.dynamoClient, this.tableName);
        success = await v3Migrate.up();
        break;

      case 4:
        const v4Migrate = new V4DisbursementMigrate(this.dynamoClient, this.tableName);
        success = await v4Migrate.up();
        break;

      default:
        console.log(`No Disbursement migration defined for version ${version}`);
    }

    return success;
  };

  /**
   * Adjust the seed data
   */
  seed = async (version: number): Promise<boolean> => {
    console.log(`Seed Disbursement Version ${version}`);

    const seed = new DisbursementSeed(this.dynamoClient, this.tableName, this.stage);
    const success = await seed.seed('./seed');

    return success;
  };

  /**
   * Load the VERSION record for this Database
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
