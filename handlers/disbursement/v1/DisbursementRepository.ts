import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { Batch, BatchResponse, BatchList, Disbursement } from './models';
import { DynamoDBComparators } from '../../../libs/enumLib';
import { DisbursementList } from './models/DisbursementList';
import { DisbursementResponse } from './models/DisbursementResponse';

export interface IGetBatchListFilters {
  state?: DisbursementRepository.BatchStateFilters;
  endBatchNumber?: string;
}

export interface IGetDisbursementsFilters {
  disbursementType?: DisbursementRepository.DisbursementRecordType;
  state?: Disbursement.States;
  stateComparator?: DynamoDBComparators;
  startDateTime?: string;
  endDateTime?: string;
  referenceNumber?: string;
}

/**
 * Disbursement Repository
 * @class DisbursementRepository
 */
export class DisbursementRepository {
  private TABLE_NAME = process.env.DISBURSEMENT_TABLE_NAME;
  private client: DocumentClient;

  /**
   * Initializes a new instance of the @see {DisbursementRepository} class.
   * @param dynamoClient Client connection object.
   */
  constructor(dynamoClient: DocumentClient) {
    this.client = dynamoClient;
  }

  /**
   * Saves the batch record.
   * @param batch The batch record to persist.
   * @param batchType
   * @returns
   */
  async saveBatch(batch: Batch, batchType: DisbursementRepository.BatchRecordType): Promise<Batch> {
    batch.pk = `${batch.entityId}_${batch.batchNumber}`;
    batch.sk = batchType;
    batch.docTypeNumber = `${batchType}_${batch.batchNumber}`;
    const params = {
      TableName: this.TABLE_NAME,
      Item: batch as DocumentClient.PutItemInputAttributeMap
    } as DocumentClient.PutItemInput;

    await this.client.put(params).promise();

    return batch;
  }

  /**
   * Saves the disbursement record.
   *
   * @param disbursement The disbursement record to persist.
   * @param disbursementType
   * @returns
   */
  async saveDisbursement(
    disbursement: Disbursement,
    disbursementType?: DisbursementRepository.DisbursementRecordType
  ): Promise<Disbursement> {
    if (!disbursement.pk) {
      // Create new record
      disbursement.disbursementNumber = (await this.getNextDisbursementNumber(disbursement.entityId)).toString();
      disbursement.pk = `${disbursement.entityId}_${disbursement.disbursementNumber}`;
      disbursement.sk = disbursementType;
      disbursement.docTypeNumber = `${disbursementType}_${disbursement.disbursementNumber.padStart(9, '0')}`;
      disbursement.createdDateTime = new Date().toISOString();
    }

    // Set released datetime
    if (disbursement.state.state === Disbursement.States.ProviderUploaded) {
      disbursement.releasedDateTime = new Date().toISOString();
    }

    const params = {
      TableName: this.TABLE_NAME,
      Item: disbursement as DocumentClient.PutItemInputAttributeMap
    } as DocumentClient.PutItemInput;

    await this.client.put(params).promise();

    return disbursement;
  }

  /**
   * Update a batch state
   * @param batchId   Pk for the batch
   * @param batchType Sk for the batch
   * @param state     Value for the "state" property
   */
  async updateBatchState(
    batchId: string,
    batchType: DisbursementRepository.BatchRecordType | string,
    state: Batch.States
  ): Promise<Batch> {
    let response: Batch = null;

    const expressionAttributeValues = { ':state': state };
    const expressionAttributeNames = { '#state': 'state' };
    let updateExpression = 'SET #state = :state';

    if (state === Batch.States.Issued) {
      updateExpression += ', #releasedDateTime = :releasedDateTime';
      expressionAttributeValues[':releasedDateTime'] = new Date().toISOString();
      expressionAttributeNames['#releasedDateTime'] = 'releasedDateTime';
    }

    const parameters = {
      TableName: this.TABLE_NAME,
      IndexName: DisbursementRepository.Indexes.BatchIndex,
      Key: {
        pk: batchId,
        sk: batchType
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW'
    };

    const result = await this.client.update(parameters).promise();

    if (result.Attributes) {
      response = result.Attributes as Batch;
    }

    return response;
  }

  /**
   * Updates a disbursement batch
   * @param disbursementId    Pk for the disbursement
   * @param disbursementType  Sk for the disbursement
   * @param batchId           New batch id
   * @param batchNumber       New batch number
   */
  async updateDisbursementBatch(
    disbursementId: string,
    disbursementType: DisbursementRepository.DisbursementRecordType,
    batchId: string,
    batchNumber: string
  ): Promise<Disbursement> {
    let response: Disbursement = null;

    const expressionAttributeValues = {
      ':batchId': batchId,
      ':batchNumber': batchNumber
    };
    const expressionAttributeNames = {
      '#batchId': 'batchId',
      '#batchNumber': 'batchNumber'
    };
    const updateExpression = 'SET #batchId = :batchId, #batchNumber = :batchNumber';

    const parameters = {
      TableName: this.TABLE_NAME,
      IndexName: DisbursementRepository.Indexes.BatchIndex,
      Key: {
        pk: disbursementId,
        sk: disbursementType
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW'
    };

    const result = await this.client.update(parameters).promise();

    if (result.Attributes) {
      response = result.Attributes as Disbursement;
    }

    return response;
  }

  /**
   * Gets the record.
   * @param recordId The batch id.
   * @param docType The document type.
   */
  async getRecord(recordId: string, docType: DisbursementRepository.BatchRecordType): Promise<Batch> {
    let batch = null;

    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: recordId,
        sk: docType
      }
    } as DocumentClient.GetItemInput;

    const result = await this.client.get(params).promise();

    if (result.Item) {
      batch = result.Item as Batch;
    }

    return batch;
  }

  /**
   * Get a disbursement
   *
   * @param disbursementId
   * @param disbursementType
   * @returns
   */
  async getDisbursement(
    disbursementId: string,
    disbursementType: DisbursementRepository.DisbursementRecordType
  ): Promise<Disbursement> {
    let disbursement = null;

    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: disbursementId,
        sk: disbursementType
      }
    } as DocumentClient.GetItemInput;

    const result = await this.client.get(params).promise();

    if (result.Item) {
      disbursement = new Disbursement(result.Item);
    }

    return disbursement;
  }

  /**
   * Get a disbursement by id
   *
   * @param disbursementId
   * @returns
   */
  async getDisbursementById(disbursementId: string): Promise<Disbursement> {
    let disbursement: Disbursement = null;

    const params = {
      TableName: this.TABLE_NAME,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeValues: {
        ':pk': disbursementId
      },
      ExpressionAttributeNames: {
        '#pk': 'pk'
      }
    };

    const result = await this.client.query(params).promise();

    if (result.Items.length > 0) {
      disbursement = new Disbursement(result.Items[0]);
    }

    return disbursement;
  }

  /**
   * Gets disbursements in a batch
   * @param batchId The batch ID
   * @param filters query filters
   */
  async getDisbursements(batchId: string, filters: IGetDisbursementsFilters = {}) {
    const { disbursementType, state, stateComparator = DynamoDBComparators.Equal } = filters;

    const expressionAttributeValues = { ':gsiPk': batchId };
    const expressionAttributeNames = { '#gsiPk': 'batchId' };
    let keyConditionExpression = '#gsiPk = :gsiPk';
    let filterExpression = '';

    if (disbursementType) {
      keyConditionExpression += ' AND begins_with(#gsiSk, :gsiSk)';
      expressionAttributeValues[':gsiSk'] = `${disbursementType}_`;
      expressionAttributeNames['#gsiSk'] = 'docTypeNumber';
    }

    if (state) {
      if (filterExpression !== '') {
        filterExpression += ' AND ';
      }

      filterExpression += `#state.#state ${stateComparator} :state`;
      expressionAttributeValues[':state'] = state;
      expressionAttributeNames['#state'] = 'state';
    }

    const params = {
      TableName: this.TABLE_NAME,
      IndexName: DisbursementRepository.Indexes.BatchIndex,
      KeyConditionExpression: keyConditionExpression,
      ScanIndexForward: false,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      FilterExpression: filterExpression || null
    } as DocumentClient.QueryInput;

    const result = await this.client.query(params).promise();
    const disbursements = result.Items.map((x) => new Disbursement(x));

    return disbursements;
  }

  /**
   * Gets list of batches.
   * @param entityId The entity id.
   * @param batchType The type of batch to get.
   * @param stateFilter The state filter to apply.
   * @param take Number of items to return.
   * @param lastEvaluatedKey The last key returned. Null for the first set of records.
   */
  async getBatchList(
    entityId: string,
    batchType: DisbursementRepository.BatchRecordType,
    filters: IGetBatchListFilters,
    take = 25,
    lastEvaluatedKey = null
  ): Promise<BatchList> {
    const { state, endBatchNumber } = filters;
    const expressionAttributeValues = {
      ':gsiPk': entityId,
      ':gsiSk': `${batchType}_`
    };

    const expressionAttributeNames = {
      '#gsiPk': 'entityId',
      '#gsiSk': 'docTypeNumber'
    };

    let filterExpression = '';

    // Status filter
    if (state) {
      if (filterExpression !== '') {
        filterExpression += ' AND ';
      }

      filterExpression += '#state = :state';
      expressionAttributeValues[':state'] = state;
      expressionAttributeNames['#state'] = 'state';
    }

    if (endBatchNumber) {
      if (filterExpression !== '') {
        filterExpression += ' AND ';
      }

      filterExpression += '#batchNumber < :endBatchNumber';
      expressionAttributeValues[':endBatchNumber'] = endBatchNumber;
      expressionAttributeNames['#batchNumber'] = 'batchNumber';
    }

    const params = {
      TableName: this.TABLE_NAME,
      IndexName: DisbursementRepository.Indexes.EntityIndex,
      KeyConditionExpression: '#gsiPk = :gsiPk and begins_with(#gsiSk, :gsiSk)',
      ScanIndexForward: false,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      FilterExpression: filterExpression || null,
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: take
    } as DocumentClient.QueryInput;

    let queryResult: DocumentClient.QueryOutput;
    const batchList: BatchList = new BatchList(
      lastEvaluatedKey,
      []
    );

    do {
      queryResult = await this.client.query(params).promise();

      params.ExclusiveStartKey = queryResult.LastEvaluatedKey;

      for (let i = 0; i < queryResult.Items.length && batchList.batches.length < take; i++) {
        const item = queryResult.Items[i];

        batchList.batches.push(new BatchResponse(item));
        batchList.lastEvaluatedKey = {
          pk: item.pk,
          sk: item.sk,
          docTypeNumber: item.docTypeNumber,
          entityId: item.entityId
        };
      }
    } while (batchList.batches.length < take && queryResult?.LastEvaluatedKey);

    return batchList;
  }

  /**
   * Gets list of disbursements.
   * @param entityId The entity id.
   * @param disbursementType The type of disbursement to get.
   * @param filters The filters to apply.
   * @param take Number of items to return.
   * @param lastEvaluatedKey The last key returned. Null for the first set of records.
   */
  async getDisbursementList(
    entityId: string,
    disbursementType: DisbursementRepository.DisbursementRecordType,
    filters: IGetDisbursementsFilters,
    take = 15,
    lastEvaluatedKey = null
  ): Promise<DisbursementList> {
    const { state, startDateTime, endDateTime, referenceNumber } = filters;
    const expressionAttributeValues = { ':gsiPk': entityId };
    const expressionAttributeNames = {
      '#gsiPk': 'entityId',
      '#gsiSk': 'docTypeNumber'
    };
    let keyConditionExpression = '#gsiPk = :gsiPk';

    // Disbursements type filter
    if (disbursementType) {
      keyConditionExpression += ' AND begins_with(#gsiSk, :gsiSk)';
      expressionAttributeValues[':gsiSk'] = `${disbursementType}_`;
    } else {
      // Get all disbursements
      expressionAttributeValues[
        ':gsiSkDisbursement'
      ] = `${DisbursementRepository.DisbursementRecordType.Disbursement}_`;
      expressionAttributeValues[
        ':gsiSkDisbursementPrint'
      ] = `${DisbursementRepository.DisbursementRecordType.DisbursementPrint}_`;
      expressionAttributeValues[
        ':gsiSkClaimDisbursement'
      ] = `${DisbursementRepository.DisbursementRecordType.ClaimDisbursement}_`;
      keyConditionExpression +=
        ' AND begins_with(#gsiSk, :gsiSkDisbursement) OR begins_with(#gsiSk, :gsiSkDisbursementPrint)';
      keyConditionExpression += ' OR begins_with(#gsiSk, :gsiSkClaimDisbursement)';
    }

    let filterExpression = '';

    // Status filter
    if (state) {
      filterExpression += '#state.#state = :state';
      expressionAttributeValues[':state'] = state;
      expressionAttributeNames['#state'] = 'state';
    }

    // Date filter
    if (startDateTime && endDateTime) {
      if (filterExpression !== '') {
        filterExpression += ' AND ';
      }

      filterExpression += '#createdDateTime between :startDateTime and :endDateTime';
      expressionAttributeValues[':startDateTime'] = startDateTime;
      expressionAttributeValues[':endDateTime'] = endDateTime;
      expressionAttributeNames['#createdDateTime'] = 'createdDateTime';
    }

    // ReferenceNumber filter
    if (referenceNumber) {
      if (filterExpression !== '') {
        filterExpression += ' AND ';
      }

      filterExpression += '#referenceNumber = :referenceNumber';
      expressionAttributeValues[':referenceNumber'] = referenceNumber;
      expressionAttributeNames['#referenceNumber'] = 'referenceNumber';
    }

    const params = {
      TableName: this.TABLE_NAME,
      IndexName: DisbursementRepository.Indexes.EntityIndex,
      KeyConditionExpression: keyConditionExpression,
      ScanIndexForward: false,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      FilterExpression: filterExpression || null,
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: take
    } as DocumentClient.QueryInput;

    let queryResult: DocumentClient.QueryOutput;
    let newLastEvaluatedKey = {};
    const disbursementList: Disbursement[] = [];

    do {
      queryResult = await this.client.query(params).promise();

      params.ExclusiveStartKey = queryResult.LastEvaluatedKey;

      for (let i = 0; i < queryResult.Items.length && disbursementList.length < take; i++) {
        const item = queryResult.Items[i];

        disbursementList.push(new Disbursement(item));
        newLastEvaluatedKey = {
          pk: item.pk,
          sk: item.sk,
          docTypeNumber: item.docTypeNumber,
          entityId: item.entityId
        };
      }
    } while (disbursementList.length < take && queryResult?.LastEvaluatedKey);

    return new DisbursementList(newLastEvaluatedKey, disbursementList);
  }

  /**
   * Get a batch by id
   *
   * @param batchId
   * @returns
   */
  async getBatchById(batchId: string, batchType: DisbursementRepository.BatchRecordType): Promise<BatchResponse> {
    let batch: BatchResponse = null;

    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: batchId,
        sk: batchType
      }
    } as DocumentClient.GetItemInput;

    const result = await this.client.get(params).promise();

    if (result.Item) {
      batch = new BatchResponse(result.Item);
    }

    return batch;
  }

  /**
   * Gets the next available disbursement number.
   * Uses an atomic update to avoid duplicates
   * @param entityId The entity id.
   */
  async getNextDisbursementNumber(entityId: string): Promise<number> {
    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: entityId,
        sk: DisbursementRepository.DisbursementRecordType.DisbursementNumber
      },
      ExpressionAttributeValues: {
        ':one': 1
      },
      ExpressionAttributeNames: {
        '#lastDisbursementNumber': 'lastDisbursementNumber'
      },
      UpdateExpression: 'ADD #lastDisbursementNumber :one',
      ReturnValues: 'UPDATED_NEW'
    };

    const result = await this.client.update(params).promise();

    return result.Attributes.lastDisbursementNumber;
  }

  /**
   * Builds the id string.
   * @param entityId
   * @param itemNumber
   */
  static buildId(entityId: string, itemNumber: string) {
    return `${entityId}_${itemNumber}`;
  }
}

export namespace DisbursementRepository {
  /**
   * Record type values.
   */
  export enum DisbursementRecordType {
    Disbursement = 'Disbursement',
    ClaimDisbursement = 'ClaimDisbursement',
    DisbursementNumber = 'DisbursementNumber',
    DisbursementPrint = 'DisbursementPrint'
  }

  export enum DisbursementReferenceType {
    Claim = 'Claim',
    Policy = 'Policy',
    Unknown = 'Unknown'
  }

  export enum BatchRecordType {
    Batch = 'Batch',
    ClaimBatch = 'ClaimBatch',
    PrintBatch = 'PrintBatch'
  }

  /**
   * Table index names
   */
  export enum Indexes {
    BatchIndex = 'BatchIndex',
    EntityIndex = 'EntityIndex'
  }

  /**
   * Batch State filter values
   */
  export enum BatchStateFilters {
    None = 'None',
    Scheduled = 'Scheduled',
    Issued = 'Issued'
  }
}
