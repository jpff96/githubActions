import * as AWS from 'aws-sdk';
import { BalanceTotal } from '../models/BalanceTotal';
import { client } from '../../../../libs/dynamodb';
import { BalanceRepository } from '../BalanceRepository';
import { BalanceTransaction } from '../models/BalanceTransaction';
import { LineItems } from '../models/LineItems';

/**
 * Main entry point for aggregate balance data stream hander.
 * @param event Event data.
 */
export const main = async (event: any) => {
  try {
    const records = event.Records.filter(
      (record) =>
        (record.eventName === 'INSERT' || record.eventName === 'MODIFY') &&
        (record.dynamodb.Keys.typeDate.S as string).startsWith('TOTALS') === false &&
        record.dynamodb.Keys.typeDate.S !== 'VERSION'
    );

    for (const record of records) {
      let oldTransaction: BalanceTransaction;
      const isModify = record.eventName === 'MODIFY';

      // Unnmarshall records to plain JSON objects
      const newTransaction = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage) as BalanceTransaction;

      if (isModify) {
        oldTransaction = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage) as BalanceTransaction;
      }

      await processRecord(newTransaction, oldTransaction, isModify);
    }

    return `Successfully processed ${event.Records.length} records.`;
  } catch (err) {
    console.error(`Error processing records. Event was [${JSON.stringify(event)} `);
    console.error(err);
    //Note we don't actually fail the lambda function here by calling back with the error e.g. callback(err)
    return `Swallowed the error`;
  }
};

/**
 * Process a single table record
 * @param newTransaction
 * @param oldTransaction
 * @param isModify
 */
export const processRecord = async (
  newTransaction: BalanceTransaction,
  oldTransaction: BalanceTransaction,
  isModify: boolean
) => {
  const balanceRepository = new BalanceRepository(client);
  const isBalance = newTransaction.balanceDue ? true : false;
  let prefix = BalanceTotal.Prefix.BalanceDue;
  const diff = new LineItems();

  if (isBalance) {
    diff.addLineItems(newTransaction.balanceDue.lineItems);

    if (isModify === true) {
      diff.subtractLineItems(oldTransaction.balanceDue.lineItems);
    }
  } else {
    prefix = BalanceTotal.Prefix.Payment;

    for (const detail of newTransaction.payment.details) {
      diff.addLineItems(detail.lineItems);
    }

    if (isModify === true) {
      for (const detail of oldTransaction.payment.details) {
        diff.subtractLineItems(detail.lineItems);
      }
    }
  }

  // Only update if there is a change to the subtotal
  if (diff.subtotal !== 0) {
    const items = diff.lineItems.reduce((subtotals, item) => {
      return {
        ...subtotals,
        [`${prefix}${item.account}`]: item.amount
      };
    }, {});

    await balanceRepository.updateTotals(
      newTransaction.policyId,
      diff.subtotal,
      items,
      isBalance,
      isModify === false ? 1 : 0
    );

    // Add term total if term is defined
    if (newTransaction.termEffectiveDate) {
      await balanceRepository.updateTotals(
        newTransaction.policyId,
        diff.subtotal,
        items,
        isBalance,
        isModify === false ? 1 : 0,
        newTransaction.termEffectiveDate
      );
    }
  }
};
