import {
  DocumentClient,
  PutItemInput,
  ScanInput,
  ScanOutput
} from 'aws-sdk/clients/dynamodb';
import { IMigrate, MigrateBase } from '@eclipsetechnology/migrationlibrary';
import { Disbursement } from '../../../handlers/disbursement/v1/models';
import { DisbursementRepository } from '../../../handlers/disbursement/v1/DisbursementRepository';
import { CostType } from '../../../libs/enumLib';

const { DisbursementRecordType } = DisbursementRepository;

/**
 * Disbursement Migration
 * @class DisbursementMigrate
 */
export class DisbursementMigrate extends MigrateBase implements IMigrate {
  /**
   * Initializes a new instance of the @see DisbursementMigrate class.
   * @param dynamoClient
   * @param tableName
   */
  constructor(dynamoClient: DocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  /**
   * Up
   */
  up = async (): Promise<boolean> => {
    let success = false;

    await this.addDisbursementsFundingAccount();
    success = true;

    return success;
  };

  /**
   * Gets all disbursements and adds funding account
   */
  private addDisbursementsFundingAccount = async () => {
    const scanParams = {
      TableName: this.tableName,
      ExpressionAttributeValues: {
        ':sk': DisbursementRecordType.Disbursement,
        ':skDisbursementNumber': DisbursementRecordType.DisbursementNumber
      },
      ExpressionAttributeNames: {
        '#sk': 'sk'
      },
      FilterExpression: 'contains(#sk, :sk) AND #sk <> :skDisbursementNumber'
    } as ScanInput;

    let scanResult: ScanOutput;

    do {
      scanResult = await this.dynamoClient.scan(scanParams).promise();

      for (const item of scanResult.Items) {
        const disbursement = item as Disbursement;
        await this.addFundingAccount(disbursement);
      }

      scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);
  };

  /**
   * Adds funding account to disbursement record
   * @param disbursement Disbursement to be updated
   */
  private addFundingAccount = async (disbursement: Disbursement) => {
    if (!disbursement.payerIdOrFundingAccountCode) {
      const fundingAccount = await this.getFundingAccount(disbursement);
      disbursement.payerIdOrFundingAccountCode = fundingAccount;

      const putParams = {
        TableName: this.tableName,
        Item: disbursement
      } as PutItemInput;

      await this.dynamoClient.put(putParams).promise();
    }
  };

  /**
   * Gets funding account
   * @param disbursement Disbursement to use
   */
  private getFundingAccount = async (disbursement: Disbursement): Promise<string> => {
    const { costType, catastropheType } = disbursement;
    const reservePaymentInfoList = [
      {
        accountingName: 'DPX Loss',
        configName: 'ClaimCost',
        name: 'Claim Cost',
        account: 'FPIC_C',
        catastrophes: []
      },
      {
        accountingName: 'DPX Expense - A&O',
        configName: 'ExpenseAdjustingAndOther',
        name: 'Expense - A&O',
        account: 'FIMI',
        catastrophes: []
      },
      {
        accountingName: 'DPX D&CC Non CAT',
        configName: 'ExpenseDefenseAndCostContainment',
        name: 'Expense - D&CC',
        account: 'FPIC_C',
        catastrophes: []
      },
      {
        accountingName: 'DPX D&CC CAT - Hurricane',
        configName: 'ExpenseDefenseAndCostContainment',
        name: 'Expense - D&CC',
        account: 'FIMI',
        catastrophes: ['Hurricane']
      },
      {
        accountingName: 'DPX D&CC CAT - Tropical Storm',
        configName: 'ExpenseDefenseAndCostContainment',
        name: 'Expense - D&CC',
        account: 'FIMI',
        catastrophes: ['TropicalStorm']
      },
      {
        accountingName: 'DPX D&CC CAT - Other',
        configName: 'ExpenseDefenseAndCostContainment',
        name: 'Expense - D&CC',
        account: 'FPIC_C',
        catastrophes: ['NonHurricaneWind', 'Hail', 'Flood', 'Other']
      },
      {
        accountingName: 'SDD Loss',
        configName: 'CompanionDeductible',
        name: 'SDD Loss',
        account: 'FIUC',
        catastrophes: []
      },
      {
        accountingName: 'SDD Expense - A&O',
        configName: 'ExpenseAdjustingAndOther',
        name: 'Expense - A&O',
        account: 'FIUC',
        catastrophes: []
      },
      {
        accountingName: 'SDD D&CC',
        configName: 'ExpenseDefenseAndCostContainment',
        name: 'Expense - D&CC',
        account: 'FIUC',
        catastrophes: []
      },
      {
        accountingName: 'Premium Refund',
        configName: 'PremiumRefund',
        name: 'Premium Refund',
        account: 'FPIC_RP',
        catastrophes: []
      },
      {
        accountingName: 'Zero Payment (Printing)',
        configName: 'ZeroPayment',
        name: 'Zero Payment (Printing)',
        account: 'FPIC_RP',
        catastrophes: []
      }
    ];

    const reservePaymentInfo = reservePaymentInfoList.find(
      (element) =>
        element.configName === costType &&
        (costType !== CostType.ExpenseDefenseAndCostContainment ||
          (costType === CostType.ExpenseDefenseAndCostContainment &&
            (!catastropheType || element.catastrophes.includes(catastropheType))
          )
        )
    );

    return reservePaymentInfo.account;
  };
}
