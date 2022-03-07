import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { formatISO } from 'date-fns';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { LockboxRepository } from '../LockboxRepository';
import { Batch } from '../models/Batch';
import { CheckTransaction } from '../models/CheckTransaction';
import { Document } from '../models/Document';
import { Image } from '../models/Image';

/**
 * checkTransaction method.
 *
 * @param transaction The transaction identifier.
 * @param amt The amount to apply to the policy amount.
 * @param policy The policy number to apply the payment to.
 * @returns A checkMapping object.
 */
export const checkTransaction = (transaction: string, amt: number, policy: string) => {
  try {
    const trans = new CheckTransaction();
    trans.checkNumber = 1001;
    trans.checkAmount = amt;
    trans.postMarkDate = '2021-02-07';
    trans.images = new Array<Image>();
    trans.amount = amt;
    trans.invoiceNumber = 'Invoice 1';
    trans.policyNumber = policy;
    trans.dueDate = '2021-02-07';
    trans.appliedDate = '2021-02-07';
    trans.transactionId = transaction;
    trans.referenceId = 'Ref#1';
    trans.status = CheckTransaction.Status.Approved;

    return trans;
  } catch (ex) {
    throw new ErrorResult(ErrorCodes.Unknown, 'Error message here');
  }
};

/**
 * Mock provider document method. For test purposes only.
 *
 * @param id The id to lookup
 * @returns A document object.
 */
export const document = (id: string) => {
  try {
    const document = new Document();
    document.documentType = 'MISC';
    document.images = new Array<Image>();
    document.status = 'None';

    document.images.push(image('/s3/image3', Image.Sides.Front, 'fileName.tiff'));
    document.images.push(image('/s3/image4', Image.Sides.Back, 'fileName.tiff'));

    return document;
  } catch (ex) {
    throw new ErrorResult(ErrorCodes.Unknown, 'Error message here');
  }
};

/**
 * Mock provider image method. For test purposes only.
 *
 * @param token The token
 * @param side The side of the image to lookup
 * @param name
 *
 * @returns An image object.
 */
export const image = (token: string, side: Image.Sides, name: string) => {
  try {
    const image = new Image(side, token, name);

    return image;
  } catch (ex) {
    throw new ErrorResult(ErrorCodes.Unknown, 'Error message here');
  }
};

/**
 * Mock provider batch. For test purposes only.
 *
 * @returns A batch object.
 */
export const makeBatch = () => {
  try {
    const batch = new Batch();
    batch.batchId = '2020122100001';
    batch.entityId = '00000000-0000-0000-0000-000000000005';
    batch.lockbox = 'OpenHouse';
    batch.account = 'OH5';
    batch.totalAmount = 300.33;
    batch.processDate = formatISO(new Date(), { representation: 'date' });
    batch.suspenseCount = 2;
    batch.approvedCount = 1;
    batch.status = Batch.Status.Balanced;
    batch.lastActionBy = 'test@user.com';
    batch.lastActionDate = '2021-02-08';

    const transaction = checkTransaction('2021000010002', 300.33, 'TESTPOLNUM');
    transaction.policyId = LockboxRepository.buildPolicyId(batch.entityId, transaction.policyNumber);
    batch.transactions.push(transaction);

    return batch;
  } catch (ex) {
    throw new ErrorResult(ErrorCodes.Unknown, 'Error message here');
  }
};
