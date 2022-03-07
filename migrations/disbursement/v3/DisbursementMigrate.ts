import {
  DocumentClient,
  PutItemInput,
  ScanInput,
  ScanOutput
} from 'aws-sdk/clients/dynamodb';
import { IMigrate, MigrateBase } from '@eclipsetechnology/migrationlibrary';
import { Disbursement, DisbursementState } from '../../../handlers/disbursement/v1/models';

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

    await this.updateDisbursementsDocTypeNumber();
    success = true;

    return success;
  };

  /**
   * Gets all disbursements and updates the
   * docTypeNumber to the new format
   */
  private updateDisbursementsDocTypeNumber = async () => {
    const scanParams = {
      TableName: this.tableName,
      ExpressionAttributeValues: {
        ':gsiSkDisbursement': 'Disbursement_',
        ':gsiSkDisbursementPrint': 'DisbursementPrint_',
        ':gsiSkClaimDisbursement': 'ClaimDisbursement_',
      },
      ExpressionAttributeNames: {
        '#gsiSk': 'docTypeNumber'
      },
      FilterExpression: 'begins_with(#gsiSk, :gsiSkDisbursement) OR begins_with(#gsiSk, :gsiSkDisbursementPrint) OR begins_with(#gsiSk, :gsiSkClaimDisbursement)',
      Limit: 10
    } as ScanInput;

    let scanResult: ScanOutput;

    do {      
      scanResult = await this.dynamoClient.scan(scanParams).promise();

      for (const item of scanResult.Items) {
        const disbursement = item as Disbursement;
        await this.replaceDisbursementState(disbursement);
        await this.updateDisbursement(disbursement);
      }

      scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);
  };

  /**
   * replace disbursement state and disbursementHistory
   */
  private replaceDisbursementState = async (disbursement: Disbursement) => {
    if(disbursement.state?.state.toString() == 'Voided'){
      disbursement.state.state = Disbursement.States.Rejected;
    }

    if (disbursement.disbursementHistory && disbursement.disbursementHistory.length > 0) {
      for (const historyLine of disbursement.disbursementHistory) {
        if (historyLine.state && historyLine.state?.state.toString() == 'Voided') {
          historyLine.state.state = Disbursement.States.Rejected;
        }
      }
    }
  }

  /**
   * Updates the docTypeNumber of a disbursement
   */
  private updateDisbursement = async (disbursement: Disbursement) => {
    disbursement.docTypeNumber = `${disbursement.sk}_${disbursement.disbursementNumber.padStart(9, '0')}`;
    const putParams = {
        TableName: this.tableName,
        Item: disbursement
      } as PutItemInput;

    await this.dynamoClient.put(putParams).promise();
  };
}
