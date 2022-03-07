import * as AWS from 'aws-sdk';
import * as yargs from 'yargs';
import { logError } from '@eclipsetechnology/eclipse-api-helpers';
import { MigrationCoordinator } from '@eclipsetechnology/migrationlibrary';
import { BalanceMigration } from './balance/BalanceMigration';
import { DisbursementMigration } from './disbursement/DisbursementMigration';
import { BillingMigration } from './billing/BillingMigration';

AWS.config.update({ region: process.env.AWS_SERVICE_REGION || 'us-west-2' });

// Set the version for the migration to use when updating databases
const BALANCE_DB_MIGRATION_VERSION: number = 3;
const DISBURSEMENT_DB_MIGRATION_VERSION: number = 4;
const BILLING_DB_MIGRATION_VERSION: number = 1;

const argv = yargs.argv;
const stage = argv['stage'];

const dynamoClient = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true });

// Balance table migration
const balanceTableName = `${stage}.solstice-api.accounting.balance`;
const balanceMigration = new BalanceMigration(dynamoClient, balanceTableName, stage);
const balanceMigrator = new MigrationCoordinator(balanceMigration);

// Disbursement table migration
const disbursementTableName = `${stage}.solstice-api.accounting.disbursement`;
const disbursementMigration = new DisbursementMigration(dynamoClient, disbursementTableName, stage);
const disbursementMigrator = new MigrationCoordinator(disbursementMigration);

// Billing table migration
const billingTableName = `${stage}.solstice-api.accounting.billing`;
const billingMigration = new BillingMigration(dynamoClient, billingTableName, stage);
const billingMigrator = new MigrationCoordinator(billingMigration);

/**
 * Migration script
 */
(async () => {
  // Balance Table
  try {
    const summaryInfo = await balanceMigrator.migrate(BALANCE_DB_MIGRATION_VERSION);
    console.log('Balance migration complete', JSON.stringify(summaryInfo, null, 2));
  } catch (ex) {
    logError(console.error, ex, 'Payment API Balance migration failed');
  }

  // Disbursement Table
  try {
    const summaryInfo = await disbursementMigrator.migrate(DISBURSEMENT_DB_MIGRATION_VERSION);
    console.log('Disbursement migration complete', JSON.stringify(summaryInfo, null, 2));
  } catch (ex) {
    logError(console.error, ex, 'Payment API Disbursement migration failed');
  }

  // Billing Table
  try {
    const summaryInfo = await billingMigrator.migrate(BILLING_DB_MIGRATION_VERSION);
    console.log('Billing migration complete', JSON.stringify(summaryInfo, null, 2));
  } catch (ex) {
    logError(console.error, ex, 'Payment API Billing migration failed');
  }
})();
