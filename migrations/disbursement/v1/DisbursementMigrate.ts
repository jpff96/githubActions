import {
  DocumentClient,
  QueryInput,
  QueryOutput,
  PutItemInput,
  ScanInput,
  ScanOutput
} from 'aws-sdk/clients/dynamodb';
import { IMigrate, MigrateBase } from '@eclipsetechnology/migrationlibrary';
import { DisbursementRepository } from '../../../handlers/disbursement/v1/DisbursementRepository';
import { Batch, Disbursement } from '../../../handlers/disbursement/v1/models';

const {
  BatchRecordType,
  DisbursementRecordType,
  DisbursementReferenceType,
  Indexes
} = DisbursementRepository;

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

    await this.moveToPrintBatch();
    await this.addDisbursementReferenceType();

    success = true;

    return success;
  };

  /**
   * Moves all the exisitng printing disbursement to the corresponding print batch.
   * If the print batch doesn't exist, create one with the same info as the original batch
   */
  private moveToPrintBatch = async () => {
    const scanParams = {
      TableName: this.tableName,
      ExpressionAttributeValues: {
        ':sk': BatchRecordType.Batch
      },
      ExpressionAttributeNames: {
        '#sk': 'sk'
      },
      FilterExpression: '#sk = :sk'
    } as ScanInput;

    let scanResult: ScanOutput;

    do {
      scanResult = await this.dynamoClient.scan(scanParams).promise();

      for (const item of scanResult.Items) {
        const batch = item as Batch;
        await this.updatePrintDisbursementsBatch(batch);
      }

      scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);
  };

  /**
   * Gets all the print disbursements for a batch and creates the
   * corresponding print batch (if needed)
   * @param batch   Batch
   */
  private updatePrintDisbursementsBatch = async (batch: Batch) => {
    const queryParams = {
      TableName: this.tableName,
      IndexName: Indexes.BatchIndex,
      KeyConditionExpression: '#gsiPk = :gsiPk AND begins_with(#gsiSk, :gsiSk)',
      ScanIndexForward: false,
      ExpressionAttributeValues: {
        ':gsiPk': batch.pk,
        ':gsiSk': `${DisbursementRecordType.DisbursementPrint}_`
      },
      ExpressionAttributeNames: {
        '#gsiPk': 'batchId',
        '#gsiSk': 'docTypeNumber'
      },
    } as QueryInput;

    let queryResult: QueryOutput;

    do {
      queryResult = await this.dynamoClient.query(queryParams).promise();

      if (queryResult.Items.length > 0) {
        await this.createPrintBatch(batch);
      }

      queryParams.ExclusiveStartKey = queryResult.LastEvaluatedKey;
    } while (queryResult.LastEvaluatedKey);
  };

  /**
   * Creates the corresponding print batch (if needed)
   * @param batch Original batch
   */
  private createPrintBatch = async (batch: Batch) => {
    let printBatch = await this.getBatch(batch.pk);

    // Create the print batch if doesn't exist already
    if (printBatch === null) {
      printBatch = new Batch(batch);
      printBatch.sk = BatchRecordType.PrintBatch;
      printBatch.docTypeNumber = `${BatchRecordType.PrintBatch}_${printBatch.batchNumber}`;

      const putParams = {
        TableName: this.tableName,
        Item: printBatch
      } as DocumentClient.PutItemInput;

      await this.dynamoClient.put(putParams).promise();
    }
  };

  /**
   * Gets a batch record
   * @param batchId Batch id
   */
  private getBatch = async (batchId: string): Promise<Batch> => {
    let batch: Batch = null;

    const getParams = {
      TableName: this.tableName,
      Key: {
        pk: batchId,
        sk: BatchRecordType.PrintBatch
      }
    } as DocumentClient.GetItemInput;

    const result = await this.dynamoClient.get(getParams).promise();

    if (result.Item) {
      batch = result.Item;
    }

    return batch;
  }

  /**
   * Adds the "referenceType" value for each disbursement
   */
  private addDisbursementReferenceType = async () => {
    const scanParams = {
      TableName: this.tableName,
      ExpressionAttributeValues: {
        ':sk': 'Disbursement',
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
        await this.setDisbursementReferenceType(disbursement);
      }

      scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;
    } while (scanResult.LastEvaluatedKey);
  };

  /**
   * Sets a disbursement referenceType value
   * @param disbursement Disbursement to be updated
   */
  private setDisbursementReferenceType = async (disbursement: Disbursement) => {
    const { referenceType: oldReferenceType } = disbursement;

    // Only set the referenceType if it wasn't set yet
    if (!oldReferenceType || oldReferenceType === DisbursementReferenceType.Unknown) {
      const newReferenceType = this.getDisbursementReferenceType(disbursement.referenceNumber);
      disbursement.referenceType = newReferenceType;

      const putParams = {
        TableName: this.tableName,
        Item: disbursement
      } as PutItemInput;

      await this.dynamoClient.put(putParams).promise();
    }
  };

  /**
   * Gets a disbursement referenceType value
   * @param referenceNumber Disbursement referenceNumber to evaluate
   */
  private getDisbursementReferenceType = (referenceNumber: string = ''): DisbursementRepository.DisbursementReferenceType => {
    let referenceType;

    // Includes "C"       -> "Claim"
    // Includes just "OH" -> "Policy"
    // Otherwise          -> "Unknown"
    if (referenceNumber?.includes('C')) {
      referenceType = DisbursementReferenceType.Claim;
    } else if (referenceNumber?.startsWith('OH')) {
      referenceType = DisbursementReferenceType.Policy;
    } else {
      referenceType = DisbursementReferenceType.Unknown
    }

    return referenceType;
  };
}
