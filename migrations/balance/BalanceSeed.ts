import { ISeed, SeedBase } from '@eclipsetechnology/migrationlibrary';

/**
 * Data Seed engine for [stage].solstice-api.accounting.balance table
 */
export class BalanceSeed extends SeedBase implements ISeed {
  /**
   * Create a new Seed engine
   *
   * @param dynamoClient The client to access the dynamo DB
   * @param tableName The name of the [stage].solstice-api.balance table
   * @param stage The stage in AWS to be seeded
   
   */
  constructor(dynamoClient: any, tableName: string, stage: string) {
    super(dynamoClient, tableName, stage);
  }

  /**
   * Load up the stage specific seed data an apply it to the database
   *
   * @returns
   */
  seed = async (path: string): Promise<boolean> => {
    let success = true;

    return success;
  };
}
