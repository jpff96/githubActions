import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { addMinutes, formatISO } from 'date-fns';
import { Billing } from './models/Billing';
import { BillingStatus } from './models/BillingStatus';
import { Invoice } from './models/Invoice';
import { Lock } from './models/Lock';

/**
 * Billing Repository
 * @class BillingRepository
 */
export class BillingRepository {
  private TABLE_NAME = process.env.BILLING_TABLE_NAME;
  private client: DocumentClient;

  /**
   * Initializes a new instance of the @see {BillingRepository} class.
   * @param dynamoClient Client connection object.
   */
  constructor(dynamoClient: DocumentClient) {
    this.client = dynamoClient;
  }

  /**
   * Saves the billing record.
   * @param billingRecord The billing record to persist.
   */
  async save(billingRecord: Billing): Promise<Billing> {
    const params = {
      TableName: this.TABLE_NAME,
      Item: billingRecord as DocumentClient.PutItemInputAttributeMap
    } as DocumentClient.PutItemInput;

    await this.client.put(params).promise();

    return billingRecord;
  }

  /**
   * Gets the billing record for this policy id.
   * @param policyId The policy Id.
   */
  async get(policyId: string) {
    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: policyId,
        sk: BillingRepository.BillingRecordType.Main
      }
    } as DocumentClient.GetItemInput;

    const result = await this.client.get(params).promise();

    return result.Item as Billing;
  }

  /**
   * Locks the billing record for this policy id.
   * @param policyId The policy Id.
   */
  async lock(policyId: string, status: BillingStatus.StatusType) {
    try {
      const now = new Date().valueOf();
      const minutesToAdd = addMinutes(new Date(), 10).valueOf();
      const params = {
        TableName: this.TABLE_NAME,
        Key: {
          pk: policyId,
          sk: BillingRepository.BillingRecordType.Main
        },
        UpdateExpression: 'SET #timestamp = :timestamp, #billingStatus.#lockStatus = :status',
        ConditionExpression: `NOT #billingStatus.#lockStatus = ${BillingStatus.StatusType.InProcess} AND NOT #timestamp BETWEEN :timestamp AND :addedMinutes `,
        ExpressionAttributeValues: {
          ':timestamp': now,
          ':status': status,
          ':addedMinutes': minutesToAdd
        },
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp',
          '#billingStatus': 'billingStatus',
          '#lockStatus': 'lockStatus'
        },
        ReturnValues: 'ALL_NEW'
      } as DocumentClient.UpdateItemInput;
      const result = await this.client.update(params).promise();

      return new Lock(result.Attributes);
    } catch (err) {
      return null;
    }
  }

  /**
   * Unlocks the billing record for this policy id.
   * @param policyId The policy Id.
   */
  async unlock(policyId: string, status: BillingStatus.StatusType) {
    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: policyId,
        sk: BillingRepository.BillingRecordType.Main
      },
      UpdateExpression: 'SET #timestamp = :timestamp, billingStatus.lockStatus = :status',
      ExpressionAttributeValues: {
        ':timestamp': 0,
        ':status': status
      },
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ReturnValues: 'ALL_NEW'
    } as DocumentClient.UpdateItemInput;

    const result: DocumentClient.UpdateItemOutput = await this.client.update(params).promise();

    return new Lock(result.Attributes);
  }

  async setInvoiceStatus(policyId: string, status: BillingStatus.StatusType) {
    const now = formatISO(new Date(), { representation: 'date' });
    //This has to be done because if we need to resend an invoice it was filled with an empty object.
    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: policyId,
        sk: BillingRepository.BillingRecordType.Main
      },
      UpdateExpression: 'SET #timestamp = :timestamp, billingStatus.invoicingStatus = :invoicingStatus',
      ExpressionAttributeValues: {
        ':timestamp': now,
        ':invoicingStatus': status
      },
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ReturnValues: 'ALL_NEW'
    } as DocumentClient.UpdateItemInput;
    const result: DocumentClient.UpdateItemOutput = await this.client.update(params).promise();

    return new Lock(result.Attributes);
  }

  async setDelinquencyStatus(policyId: string, status: BillingStatus.DelinquencyStatus) {
    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: policyId,
        sk: BillingRepository.BillingRecordType.Main
      },
      UpdateExpression: 'SET billingStatus.delinquencyStatus = :delinquencyStatus',
      ExpressionAttributeValues: {
        ':delinquencyStatus': status
      },
      ReturnValues: 'UPDATED_NEW'
    } as DocumentClient.UpdateItemInput;
    const result: DocumentClient.UpdateItemOutput = await this.client.update(params).promise();

    return result;
  }

  /**
   * Gets list of policy Ids by product key and due date. Returns all items up to and including
   * the due date specified.
   * @param productKey The product key.
   * @param dueDate The due date.
   * @param take Number of items to return in each batch.
   * @param lastEvaluatedKey The last key returned from a previous batch. Null for the first batch.
   */
  async getByDueDate(productKey: string, dueDate: Date, take = 25, lastEvaluatedKey = null) {
    const date = formatISO(dueDate, { representation: 'date' });
    const params = {
      TableName: this.TABLE_NAME,
      IndexName: 'productDueIndex',
      KeyConditionExpression: '#gsiPk = :gsiPk and #gsiSk <= :gsiSk',
      ExpressionAttributeValues: {
        ':gsiPk': productKey,
        ':gsiSk': date
      },
      ExpressionAttributeNames: {
        '#gsiPk': 'productKey',
        '#gsiSk': 'dueDate',
        '#policyId': 'pk'
      },
      ProjectionExpression: '#policyId',
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: take
    } as DocumentClient.QueryInput;

    const result = await this.client.query(params).promise();
    const policyList = new PolicyList(
      result.LastEvaluatedKey,
      result.Items.map((x) => x.pk)
    );

    return policyList;
  }

  /**
   * Gets list of policy Ids by product key and cancel date. Returns all items up to and including
   * the cancel date specified.
   * @param productKey The product key.
   * @param cancelDate The cancel date.
   * @param take Number of items to return in each batch.
   * @param lastEvaluatedKey The last key returned from a previous batch. Null for the first batch.
   */
  async getByCancelDate(productKey: string, cancelDate: Date, take = 25, lastEvaluatedKey = null) {
    const date = formatISO(cancelDate, { representation: 'date' });
    const params = {
      TableName: this.TABLE_NAME,
      IndexName: 'productCancelIndex',
      KeyConditionExpression: '#gsiPk = :gsiPk and #gsiSk <= :gsiSk',
      ExpressionAttributeValues: {
        ':gsiPk': productKey,
        ':gsiSk': date
      },
      ExpressionAttributeNames: {
        '#gsiPk': 'productKey',
        '#gsiSk': 'cancelDate',
        '#policyId': 'pk'
      },
      ProjectionExpression: '#policyId',
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: take
    } as DocumentClient.QueryInput;

    const result = await this.client.query(params).promise();
    const policyList = new PolicyList(
      result.LastEvaluatedKey,
      result.Items.map((x) => x.pk)
    );

    return policyList;
  }

  /**
   * Gets the next available invoice number.
   * Uses an atomic update to avoid duplicates
   * @param entityId The entity id.
   */
  async getNextInvoiceNumber(entityId: string): Promise<number> {
    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: entityId,
        sk: BillingRepository.BillingRecordType.InvoiceNumber
      },
      ExpressionAttributeValues: {
        ':one': 1
      },
      ExpressionAttributeNames: {
        '#lastInvoiceNumber': 'lastInvoiceNumber'
      },
      UpdateExpression: 'ADD #lastInvoiceNumber :one',
      ReturnValues: 'UPDATED_NEW'
    };

    const result = await this.client.update(params).promise();

    return result.Attributes.lastInvoiceNumber;
  }

  /**
   * Save delinquency details on a list.
   * @param detail delinquency details.
   */
  async saveDelinquencyDetails(policyId: string, detail) {
    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: policyId,
        sk: BillingRepository.BillingRecordType.Main
      },
      UpdateExpression:
        'SET #delinquencyDetail = list_append(if_not_exists( #delinquencyDetail, :empty), :delinquencyDetail)',
      ExpressionAttributeValues: {
        ':delinquencyDetail': [detail],
        ':empty': []
      },
      ExpressionAttributeNames: {
        '#delinquencyDetail': 'delinquencyDetail'
      },
      ReturnValues: 'UPDATED_NEW'
    } as DocumentClient.UpdateItemInput;

    const result: DocumentClient.UpdateItemOutput = await this.client.update(params).promise();

    return result;
  }

  /**
   * Saves the invoice record.
   * @param invoice The billing record to persist.
   */
  async saveInvoice(invoice: Invoice): Promise<Invoice> {
    invoice.sk = `${BillingRepository.BillingRecordType.Invoice}_${invoice.invoiceNumber}`;
    const params = {
      TableName: this.TABLE_NAME,
      Item: invoice as DocumentClient.PutItemInputAttributeMap
    } as DocumentClient.PutItemInput;

    await this.client.put(params).promise();

    return invoice;
  }

  /**
   * Saves the invoice inside a list of invoices.
   * @param invoice The billing record to persist.
   */
  async saveInvoices(listOfInvoices: Array<Invoice>) {
    if (listOfInvoices.length !== 0) {
      for (const invoice of listOfInvoices) {
        this.saveInvoice(invoice);
      }
    }
  }

  /**
   * Gets the invoice record.
   * @param policyId The policy Id.
   * @param invoiceNumber The invoice number
   */
  async getInvoice(policyId: string, invoiceNumber: string): Promise<Invoice> {
    const params = {
      TableName: this.TABLE_NAME,
      Key: {
        pk: policyId,
        sk: `${BillingRepository.BillingRecordType.Invoice}_${invoiceNumber}`
      }
    } as DocumentClient.GetItemInput;

    const result = await this.client.get(params).promise();

    return new Invoice(result.Item);
  }

  /**
   * Gets all of the invoice records.
   * @param policyId The policy Id.
   */
  async getAllInvoices(policyId: string): Promise<Array<Invoice>> {
    const params = {
      TableName: this.TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :start)',
      ExpressionAttributeValues: {
        ':pk': policyId,
        ':start': BillingRepository.BillingRecordType.Invoice
      },
      ExpressionAttributeNames: {
        '#pk': 'pk',
        '#sk': 'sk'
      }
    } as DocumentClient.QueryInput;

    const result = await this.client.query(params).promise();

    return result.Items.map((x) => new Invoice(x));
  }

  /**
   * Gets the invoice records with the provided status.
   * @param policyId The policy Id.
   * @param status The status requested.
   */
  async getInvoicesByStatus(policyId: string, status: Invoice.PaymentStatus): Promise<Array<Invoice>> {
    const params = {
      TableName: this.TABLE_NAME,
      IndexName: 'invoiceStatusIndex',
      KeyConditionExpression: '#gsiPk = :gsiPk and #gsiSk = :gsiSk',
      ExpressionAttributeValues: {
        ':gsiPk': policyId,
        ':gsiSk': status
      },
      ExpressionAttributeNames: {
        '#gsiPk': 'pk',
        '#gsiSk': 'paymentStatus'
      }
    } as DocumentClient.QueryInput;

    const result = await this.client.query(params).promise();

    return result.Items.map((x) => new Invoice(x));
  }
}

export namespace BillingRepository {
  /**
   * Status values.
   */
  export enum BillingRecordType {
    Main = 'Main',
    InvoiceNumber = 'InvoiceNumber',
    Invoice = 'Invoice'
  }
}
