import { ESPayment } from './models/ESPayment';
import { Client } from '@elastic/elasticsearch';
import * as AWS from 'aws-sdk';
import { AccountingDocType, ESEventType, StreamTable } from '../../../libs/enumLib';
import { EntityAPI } from '../../../libs/API/EntityAPI';
import { ESLockbox } from './models/ESLockbox';
import { logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';

const {
  ES_ENDPOINT,
  ES_PAYMENT_SEARCH_INDEX,
  ES_LOCKBOX_SEARCH_INDEX,
  ES_SEARCH_TYPE,
  ES_USERNAME,
  ES_PASSWORD,
  PAYMENT_ENABLE_TRACE
} = process.env;

const client = new Client({
  node: ES_ENDPOINT,
  auth: {
    username: ES_USERNAME,
    password: ES_PASSWORD
  }
});

const ancestorsInfo = [];
const loggerInfo = new LoggerInfo(console.log, String(PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');

/**
 * Main entry point for data stream from dynamodb to elasticsearch.
 * @param event Stream data
 */
export const main = async (event) => {
  logTrace(loggerInfo, '🚀', 'Stream received event', event);

  // Get payment records
  const paymentRecords = event.Records.filter((record) =>
    record.eventSourceARN.includes(StreamTable.Balance) &&
    record.dynamodb.Keys.typeDate.S.includes(AccountingDocType.Payment));

  if (paymentRecords) {
    await handlePaymentRecords(paymentRecords);
  }

  // Get lockbox records
  const lockboxRecords = event.Records.filter((record) =>
    record.eventSourceARN.includes(StreamTable.Lockbox));

  if (lockboxRecords) {
    await handleLockboxRecords(lockboxRecords);
  }
};

/**
 * Handle payment records.
 * @param records The records
 */
const handlePaymentRecords = async (records) => {
  for (const record of records) {
    const { eventName, dynamodb } = record;

    let response;
    switch (eventName) {
      case ESEventType.Remove:
        // Unnmarshall record to plain JSON objects
        const unmarshalledOldRecord = AWS.DynamoDB.Converter.unmarshall(dynamodb.OldImage);

        response = await client.delete({
          index: ES_PAYMENT_SEARCH_INDEX,
          type: ES_SEARCH_TYPE,
          id: unmarshalledOldRecord.policyId
        });
      default:
        // Unnmarshall record to plain JSON objects
        const unmarshalledNewRecord = AWS.DynamoDB.Converter.unmarshall(dynamodb.NewImage);

        const { policyId, entityId, payment } = unmarshalledNewRecord;

        if (entityId && payment) {
          const ancestors = await getAncestors(entityId);

          const esPayment = new ESPayment(payment, ancestors, entityId);

          response = await client.index({
            index: ES_PAYMENT_SEARCH_INDEX,
            type: ES_SEARCH_TYPE,
            id: policyId,
            body: esPayment
          });
        }
    }

    logTrace(loggerInfo, '🚀', 'Elasticsearch payment response', response);
  }
}

/**
 * Handle lockbox records.
 * @param records The records
 */
const handleLockboxRecords = async (records) => {
  for (const record of records) {
    // Unnmarshall record to plain JSON objects
    const unmarshalledNewRecord = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

    const { entityId, processDate, transactions } = unmarshalledNewRecord;

    if (entityId && transactions) {
      const ancestors = await getAncestors(entityId);

      for (const transaction of transactions) {
        const esLockbox = new ESLockbox(entityId, processDate, transaction, ancestors);

        const response = await client.index({
          index: ES_LOCKBOX_SEARCH_INDEX,
          type: ES_SEARCH_TYPE,
          id: transaction.policyId,
          body: esLockbox
        });

        logTrace(loggerInfo, '🚀', 'Elasticsearch lockbox response', response);
      }
    }
  }
}

/**
 * Get ancestors from Entity-API.
 * @param entityId The entity id
 */
const getAncestors = async (entityId: string): Promise<Array<string>> => {
  const ancestorInfo = ancestorsInfo.find((anc) => anc.entityId === entityId);

  let ancestors: Array<string>;
  if (!ancestorInfo) {
    ancestors = await EntityAPI.getAncestors(entityId);
    ancestors = ancestors.map((anc) => anc.replace(/-/g, ''));

    ancestorsInfo.push({
      entityId,
      info: ancestors
    });
  } else {
    ancestors = ancestorInfo.info;
  }

  return ancestors;
}
