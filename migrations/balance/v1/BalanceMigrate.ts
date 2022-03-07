import { IMigrate, MigrateBase } from '@eclipsetechnology/migrationlibrary';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';

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
    // No migration needed for v1
    return true;
  };
}
