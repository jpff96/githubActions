import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { ErrorCodes } from '../../../libs/errors/ErrorCodes';
import { NotFoundError } from '../../../libs/errors/NotFoundError';
import { Batch } from './models/Batch';
import { BatchList } from './models/BatchList';
import { CheckTransaction } from './models/CheckTransaction';

/**
 * Lockbox Repository
 * @class LockboxRepository
 */
export class LockboxRepository {
  private TABLE_NAME = process.env.LOCKBOX_TABLE_NAME;
  private client: DocumentClient;

  /**
   * Initializes a new instance of the @see {LockboxRepository} class.
   * @param dynamoClient Client connection object.
   */
  constructor(dynamoClient: DocumentClient) {
    this.client = dynamoClient;
  }

  /**
   * Saves the batch record.
   * @param batch The batch record to persist.
   */
  async saveBatch(batch: Batch): Promise<Batch> {
    batch.pk = `${batch.entityId}_${batch.batchId}`;
    const params = {
      TableName: this.TABLE_NAME,
      Item: batch as DocumentClient.PutItemInputAttributeMap
    } as DocumentClient.PutItemInput;

    await this.client.put(params).promise();

    return batch;
  }

  /**
   * Gets the batch record for this batch id.
   * @param batchId The batch id.
   */
  async getBatch(batchId: string): Promise<Batch> {
    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: batchId,
        sk: LockboxRepository.LockboxRecordType.Batch
      }
    } as DocumentClient.GetItemInput;

    const result = await this.client.get(params).promise();

    return result.Item as Batch;
  }

  /**
   * Gets list of batches by date.
   * @param entityId The entity id.
   * @param statusFilter The status filter to apply.
   * @param take Number of items to return.
   * @param lastEvaluatedKey The last key returned. Null for the first set of records.
   */
  async getList(entityId: string, statusFilter: LockboxRepository.StatusFilters, take = 25, lastEvaluatedKey = null) {
    const params = {
      TableName: this.TABLE_NAME,
      IndexName: LockboxRepository.Indexes.ProcessDateIndex,
      KeyConditionExpression: '#gsiPk = :gsiPk',
      ExpressionAttributeValues: {
        ':gsiPk': entityId
      },
      ExpressionAttributeNames: {
        '#gsiPk': 'entityId'
      },
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: take,
      ScanIndexForward: false
    } as DocumentClient.QueryInput;

    // Status filter
    switch (statusFilter) {
      case LockboxRepository.StatusFilters.NotReleased:
        params.FilterExpression = '#status = :suspense or #status = :pending';
        params.ExpressionAttributeValues[':suspense'] = `${Batch.Status.Suspense}`;
        params.ExpressionAttributeValues[':pending'] = `${Batch.Status.Balanced}`;
        params.ExpressionAttributeNames['#status'] = 'status';
        break;
      case LockboxRepository.StatusFilters.Suspense:
        params.FilterExpression = '#status = :status';
        params.ExpressionAttributeValues[':status'] = `${Batch.Status.Suspense}`;
        params.ExpressionAttributeNames['#status'] = 'status';
        break;
      case LockboxRepository.StatusFilters.Balanced:
        params.FilterExpression = '#status = :status';
        params.ExpressionAttributeValues[':status'] = `${Batch.Status.Balanced}`;
        params.ExpressionAttributeNames['#status'] = 'status';
        break;
      case LockboxRepository.StatusFilters.Released:
        params.FilterExpression = '#status = :status';
        params.ExpressionAttributeValues[':status'] = `${Batch.Status.Released}`;
        params.ExpressionAttributeNames['#status'] = 'status';
        break;
      default:
      // Leave filter undefined for default case.
    }

    let queryResult: DocumentClient.QueryOutput;
    const batchList: BatchList = new BatchList(lastEvaluatedKey, []);

    do {
      queryResult = await this.client.query(params).promise();

      params.ExclusiveStartKey = queryResult.LastEvaluatedKey;

      for (let i = 0; i < queryResult.Items.length && batchList.batches.length < take; i++) {
        const item = queryResult.Items[i];

        batchList.batches.push(new Batch(item));
        batchList.lastEvaluatedKey = {
          pk: item.pk,
          sk: item.sk
        };
      }
    } while (batchList.batches.length < take && queryResult.LastEvaluatedKey);

    return batchList;
  }

  /**
   * Updates the note field on the batch record.
   * @param batchId The batch record id.
   * @param transaction The transaction id.
   * @param note The note to update/add.
   */
  async updateNote(batchId: string, transactionId: string, note: string): Promise<CheckTransaction> {
    const batch = await this.getBatch(batchId);
    let trans: CheckTransaction;

    if (batch) {
      trans = batch.transactions.find((x) => x.transactionId === transactionId);

      if (trans) {
        trans.note = note;
        await this.saveBatch(batch);
      } else {
        throw new NotFoundError(ErrorCodes.NotFound, 'Transaction not found.');
      }
    } else {
      throw new NotFoundError(ErrorCodes.NotFound, 'Batch not found.');
    }

    return trans;
  }

  /**
   * Gets the batch transaction record for this batch id.
   * @param batchId The batch id.
   * @param transaction The transaction id.
   */
  async getTransaction(batchId: string, transactionId: string): Promise<CheckTransaction> {
    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: batchId,
        sk: LockboxRepository.LockboxRecordType.Batch
      }
    } as DocumentClient.GetItemInput;

    const result = await this.client.get(params).promise();
    const batch = result.Item as Batch;

    if (batch) {
      const trans = batch.transactions.find((x) => x.transactionId === transactionId);

      return trans;
    } else {
      throw new NotFoundError(ErrorCodes.NotFound, 'Batch not found.');
    }
  }

  /**
   * Updates the batch transaction record for this batch id.
   * @param batchId The batch id.
   * @param transaction The transaction to update.
   */
  async updateTransaction(batchId: string, transaction: CheckTransaction): Promise<CheckTransaction> {
    const batch = await this.getBatch(batchId);

    if (batch) {
      const index = batch.transactions.findIndex((x) => x.transactionId === transaction.transactionId);

      if (index >= 0) {
        batch.transactions[index] = transaction;
        await this.saveBatch(batch);
      } else {
        throw new NotFoundError(ErrorCodes.NotFound, 'Transaction not found.');
      }
    } else {
      throw new NotFoundError(ErrorCodes.NotFound, 'Batch not found.');
    }

    return transaction;
  }

  /**
   * Builds the policy id string.
   * @param entityId
   * @param policyNumber
   */
  static buildPolicyId(entityId: string, policyNumber: string) {
    return `${entityId}_${policyNumber}`;
  }
}

export namespace LockboxRepository {
  /**
   * Record type values.
   */
  export enum LockboxRecordType {
    Batch = 'Batch'
  }

  /**
   * Table index names
   */
  export enum Indexes {
    ProcessDateIndex = 'processDateIndex'
  }

  /**
   * Status filter values
   */
  export enum StatusFilters {
    None = 'None',
    Balanced = 'Balanced',
    Suspense = 'Suspense',
    Released = 'Released',
    NotReleased = 'NotReleased' // Pending and Suspense
  }
}
