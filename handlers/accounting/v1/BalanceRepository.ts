import { AttributeValue, DocumentClient, QueryInput, QueryOutput } from 'aws-sdk/clients/dynamodb';
import { AccountingDocType } from '../../../libs/enumLib';
import { AttributeMap } from './models/AttributeMap';
import { BalanceTotal } from './models/BalanceTotal';
import { BalanceTransaction } from './models/BalanceTransaction';
import { IBalanceTransaction } from './models/IBalanceTransaction';

/**
 * Balance Repository
 */
export class BalanceRepository {
  private TABLE_NAME = process.env.BALANCE_TABLE_NAME;
  private client: DocumentClient;

  /**
   * Initializes a new instance of the @see BalanceRepository class.
   * @param dynamoClient Client connection object.
   */
  constructor(dynamoClient: DocumentClient) {
    this.client = dynamoClient;
  }

  /**
   * Creates a new charge or payment transaction record.
   * @param trans The balance transaction to persist.
   */
  async createTransaction(trans: BalanceTransaction): Promise<BalanceTransaction> {
    const params = {
      TableName: this.TABLE_NAME,
      Item: { ...trans },
      ConditionExpression: 'policyId <> :id AND typeDate <> :typeDate',
      ExpressionAttributeValues: {
        ':id': trans.policyId,
        ':typeDate': trans.typeDate
      }
    };

    await this.client.put(params).promise();

    return trans;
  }

  /**
   * Updates the totals record for the policy
   * @param policyId The policy.
   * @param amount The total amount to add.
   * @param items Breakdown of total values by account.
   * @param isBalance True for a balance total update, otherwise false.
   * @param count The count to add. Set to 0 when trigger is a modify existing record.
   * @param termEffectiveDate Optional term effective date.
   * @returns
   */
  async updateTotals(
    policyId: string,
    amount: number,
    items: AttributeMap,
    isBalance: boolean,
    count = 1,
    termEffectiveDate?: string
  ) {
    let params: DocumentClient.UpdateItemInput;
    let typeDate: string = AccountingDocType.Totals;

    if (termEffectiveDate) {
      typeDate += `_${termEffectiveDate}`;
    }

    if (isBalance === true) {
      params = {
        TableName: this.TABLE_NAME,
        Key: {
          policyId: policyId,
          typeDate: typeDate
        },
        UpdateExpression: 'ADD #ttlBalDue :amt,#balDueCount :cnt',
        ExpressionAttributeNames: {
          '#ttlBalDue': 'totalBalanceDue',
          '#balDueCount': 'balanceDueCount'
        },
        ExpressionAttributeValues: {
          ':amt': amount,
          ':cnt': count
        }
      } as DocumentClient.UpdateItemInput;
    } else {
      params = {
        TableName: this.TABLE_NAME,
        Key: {
          policyId: policyId,
          typeDate: typeDate
        },
        UpdateExpression: 'ADD #ttlPay :amt,#payCnt :cnt',
        ExpressionAttributeNames: {
          '#ttlPay': 'totalPayments',
          '#payCnt': 'paymentCount'
        },
        ExpressionAttributeValues: {
          ':amt': amount,
          ':cnt': count
        }
      } as DocumentClient.UpdateItemInput;
    }

    // Build name/value pairs and add to the update expression.
    for (const name of Object.getOwnPropertyNames(items)) {
      params.ExpressionAttributeNames['#' + name] = name;
      params.ExpressionAttributeValues[':' + name] = items[name];
      params.UpdateExpression += `,#${name} :${name}`;
    }

    await this.client.update(params).promise();
  }

  /**
   * Gets the latest version of the balance totals with this policy id.
   * @param policyId The policy Id.
   * @param termEffectiveDate The term effective date for the totals record.
   */
  async getTotals(policyId: string, termEffectiveDate?: string) {
    let typeDate: string = AccountingDocType.Totals;

    if (termEffectiveDate) {
      typeDate += `_${termEffectiveDate}`;
    }

    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        policyId: policyId,
        typeDate: typeDate
      },
      ConsistentRead: true
    } as DocumentClient.GetItemInput;

    const result = await this.client.get(params).promise();

    return result.Item as BalanceTotal;
  }

  /**
   * Gets the list of transactions with this policy id.
   * @param policyId
   * @param termEffectiveDate
   * @param transactionType
   * @returns
   */
  async getTransactions(policyId: string, termEffectiveDate?: string, transactionType?: AccountingDocType) {
    const result = [];
    let queryResult: QueryOutput;

    const params = {
      TableName: this.TABLE_NAME,
      KeyConditionExpression: '#id = :id',
      ExpressionAttributeValues: {
        ':id': policyId
      },
      ExpressionAttributeNames: {
        '#id': 'policyId'
      },
      ScanIndexForward: false
    } as QueryInput;

    if (termEffectiveDate) {
      params.FilterExpression = '#termEffectiveDate = :termEffectiveDate';
      params.ExpressionAttributeNames['#termEffectiveDate'] = 'termEffectiveDate';
      params.ExpressionAttributeValues[':termEffectiveDate'] = termEffectiveDate as AttributeValue;
    }

    if (transactionType) {
      params.KeyConditionExpression += ' and begins_with(#typeDate, :type)';
      params.ExpressionAttributeNames['#typeDate'] = 'typeDate';
      params.ExpressionAttributeValues[':type'] = transactionType as AttributeValue;
    }

    do {
      queryResult = await this.client.query(params).promise();

      if (queryResult.Items?.length > 0) {
        result.push(...queryResult.Items);
      }

      params.ExclusiveStartKey = queryResult.LastEvaluatedKey;
    } while (queryResult.LastEvaluatedKey);

    return result as Array<IBalanceTransaction>;
  }

  /**
   * Gets a balance transaction.
   * @param policyId pk
   * @param typeDate sk
   */
  async getTransaction(policyId: string, typeDate: string) {
    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        policyId: policyId,
        typeDate: typeDate
      }
    };

    const result = await this.client.get(params).promise();

    return result.Item as BalanceTransaction;
  }

  /**
   * Updates a balance transaction.
   * @param transaction The transaction to update.
   */
  async updateTransaction(transaction: BalanceTransaction) {
    const params = {
      TableName: this.TABLE_NAME,
      Item: transaction
    };

    await this.client.put(params).promise();
  }

  /**
   * Gets all the transactions between two dates.
   * @param policyId the policyId.
   * @param transactionType the type of the transaction to get.
   * @param startDateTime the start date time of transactions.
   * @param endDateTime the end date time of transactions.
   */
  async getTransactionsByDate(
    policyId: string,
    transactionType: string,
    startDateTime: string,
    endDateTime: string
  ): Promise<Array<BalanceTransaction>> {
    let params = {
      TableName: this.TABLE_NAME,
      KeyConditionExpression: '#id = :id AND #typeDate BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':id': policyId,
        ':start': `${transactionType}_${startDateTime}`,
        ':end': `${transactionType}_${endDateTime}`
      },
      ExpressionAttributeNames: {
        '#id': 'policyId',
        '#typeDate': 'typeDate'
      },
      ScanIndexForward: false
    };

    const result = [];

    let queryResult = await this.client.query(params).promise();

    if (queryResult?.Items?.length > 0) {
      result.push(...queryResult.Items);
    }

    return result as Array<BalanceTransaction>;
  }
}
