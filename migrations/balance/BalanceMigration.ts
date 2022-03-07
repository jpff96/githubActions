import { IMigration } from '@eclipsetechnology/migrationlibrary';
import { KeyValueDefaults } from '@eclipsetechnology/migrationlibrary/dist/Const';
import { V1BalanceMigrate } from './v1';
import { V2BalanceMigrate } from './v2';
import { BalanceSeed } from './BalanceSeed';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { V3BalanceMigrate } from './v3';

/**
 * Balance table migration
 * @class BalanceMigration
 */
export class BalanceMigration implements IMigration {
  private dynamoClient: any;
  private tableName: string;
  private stage: string;

  private pkValue: string = KeyValueDefaults.PK;
  private skValue: string = KeyValueDefaults.SK;

  /**
   * Initializes a new instance of the @see BalanceMigration class.
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
    console.log(`Migrate Balance Version ${version}`);
    let success = false;

    switch (version) {
      case 1:
        const v1Migrate = new V1BalanceMigrate(this.dynamoClient, this.tableName);
        success = await v1Migrate.up();
        break;

      case 2:
        const v2Migrate = new V2BalanceMigrate(this.dynamoClient, this.tableName);
        success = await v2Migrate.up();
        break;

      case 3:
        const v3Migrate = new V3BalanceMigrate(this.dynamoClient, this.tableName, this.stage);
        success = await v3Migrate.up();
        break;

      default:
        console.log(`No Balance migration defined for version ${version}`);
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
    console.log(`Seed Balance Version ${version}`);

    const seed = new BalanceSeed(this.dynamoClient, this.tableName, this.stage);

    let success = false;

    switch (version) {
      case 1:
      case 2:
      case 3:
        success = await seed.seed('./v1');
        break;

      default:
        console.log(`No Balance seed defined for version ${version}`);
    }

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
        policyId: this.pkValue,
        typeDate: this.skValue
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
        policyId: this.pkValue,
        typeDate: this.skValue
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
