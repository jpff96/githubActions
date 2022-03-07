import { ISeed, SeedBase } from '@eclipsetechnology/migrationlibrary';

/**
 * Data Seed engine for [stage].solstice-api.accounting.billing table
 */
export class BillingSeed extends SeedBase implements ISeed {
  /**
   * Create a new Seed engine
   *
   * @param dynamoClient The client to access the dynamo DB
   * @param tableName The name of the [stage].solstice-api.billing table
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

    try {
      // Load the seed data that is specific to this stage
      const { seedData: actionSeedData } = require(`${path}/billingSeed.json`);
      for (const record of actionSeedData) {
        await this.save(record);
      }
    } catch (err) {
      console.log(`An error occurred loading seed data: ${err.message}`, err);
      success = false;
    }

    return success;
  };
}
