import { APIGatewayProxyEvent } from 'aws-lambda';
import * as chai from 'chai';
import * as sinon from 'sinon';
import { main } from '../main';
import * as mock from '../schedule/mock';
import { LockboxRepository } from '../LockboxRepository';
import { Batch } from '../models/Batch';
import { BatchList } from '../models/BatchList';
import { CheckTransaction } from '../models/CheckTransaction';
import { BillingRepository } from '../../../accounting/v1/BillingRepository';
import { Billing } from '../../../accounting/v1/models/Billing';
import { Invoice } from '../../../accounting/v1/models/Invoice';
import { PaymentPlan } from '../../../accounting/v1/models/PaymentPlan';
import { LineItem } from '../../../accounting/v1/models/LineItem';
import { PaymentUserInformation } from '../../../accounting/v1/models/PaymentUserInformation';
import { BalanceRepository } from '../../../accounting/v1/BalanceRepository';
import { BalanceTransaction } from '../../../accounting/v1/models/BalanceTransaction';

/**
 * Tests for lockbox
 */
describe('Test Lockbox', function () {
  const expect = chai.expect;

  context('lockbox', function () {
    const event: APIGatewayProxyEvent = ({
      httpMethod: 'GET',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json'
      },
      path: '/lockbox/v1/00000000-0000-0000-0000-000000000005_2020122100001',
      queryStringParameters: {
        statusFilter: 'NotReleased',
        take: 15,
        lastEvaluatedKey: null
      },
      requestContext: {
        authorizer: {
          tenantId: '00000000-0000-0000-0000-000000000005',
          principalId: 'cognitoIdentityId-USER-1234',
          email: 'test@user.com',
          isConsumer: 'false'
        }
      }
    } as unknown) as APIGatewayProxyEvent;

    // Get Batch
    sinon.replace(
      LockboxRepository.prototype,
      'getBatch',
      (batch: string): Promise<Batch> => {
        return Promise.resolve(mock.makeBatch());
      }
    );

    // Save Batch
    sinon.replace(
      LockboxRepository.prototype,
      'saveBatch',
      (batch: Batch): Promise<Batch> => {
        return Promise.resolve(batch);
      }
    );

    // Get List
    sinon.replace(
      LockboxRepository.prototype,
      'getList',
      (batch: string): Promise<BatchList> => {
        return Promise.resolve(new BatchList(null, [mock.makeBatch()]));
      }
    );

    // Update Note
    sinon.replace(
      LockboxRepository.prototype,
      'updateNote',
      (batchId: string, transactionId: string, note: string): Promise<CheckTransaction> => {
        const trans = mock.checkTransaction('2021000010002', 300.33, 'TESTPOLNUM');
        trans.note = note;

        return Promise.resolve(trans);
      }
    );

    // Get Transaction
    sinon.replace(
      LockboxRepository.prototype,
      'getTransaction',
      (batchId: string, transactionId: string): Promise<CheckTransaction> => {
        const trans = mock.checkTransaction('2021000010002', 300.33, 'TESTPOLNUM');

        return Promise.resolve(trans);
      }
    );

    // Update Transaction
    sinon.replace(
      LockboxRepository.prototype,
      'updateTransaction',
      (batchId: string, transaction: CheckTransaction): Promise<CheckTransaction> => {
        return Promise.resolve(transaction);
      }
    );

    // Create Transaction
    sinon.replace(
      BalanceRepository.prototype,
      'createTransaction',
      (trans: BalanceTransaction): Promise<BalanceTransaction> => {
        return Promise.resolve(trans);
      }
    );

    // Update Transaction
    sinon.replace(
      BillingRepository.prototype,
      'get',
      (policyId: string): Promise<Billing> => {
        const billing = new Billing();
        billing.pk = policyId;
        billing.paymentPlan.responsibleParty = PaymentPlan.ResponsibleParty.Mortgagee;
        billing.paymentDetail.lineItems.push(
          new LineItem({
            account: 'Main',
            amount: 2916.5,
            itemType: 'Premium',
            writingCompany: 'FPIC'
          })
        );
        billing.paymentDetail.lineItems.push(
          new LineItem({
            account: 'Companion',
            amount: 501.33,
            itemType: 'Premium',
            writingCompany: 'FPIC'
          })
        );
        billing.expirationDate = '2020-11-01';
        billing.userInformation = new PaymentUserInformation();
        billing.userInformation.policyId = policyId;
        billing.userInformation.version = '1';
        return Promise.resolve(billing);
      }
    );

    // Get Invoice
    sinon.replace(
      BillingRepository.prototype,
      'getInvoice',
      (policyId: string, invoiceNumber: string): Promise<Invoice> => {
        const invoice = new Invoice();
        invoice.invoiceNumber = 'Invoice 1';
        return Promise.resolve(invoice);
      }
    );

    // Get Invoices by status
    sinon.replace(
      BillingRepository.prototype,
      'getInvoicesByStatus',
      (policyId: string, status: Invoice.PaymentStatus): Promise<Array<Invoice>> => {
        const invoice = new Invoice();
        invoice.invoiceNumber = 'Invoice 1';
        return Promise.resolve([invoice]);
      }
    );

    // Save Invoice
    sinon.replace(
      BillingRepository.prototype,
      'saveInvoice',
      (invoice: Invoice): Promise<Invoice> => {
        return Promise.resolve(invoice);
      }
    );

    // Save billing record
    sinon.replace(
      BillingRepository.prototype,
      'save',
      (billingRecord: Billing): Promise<Billing> => {
        return Promise.resolve(billingRecord);
      }
    );

    /**
     * Get
     */
    it('should get a batch', async function () {
      // Arrange
      const getEvent = { ...event };
      getEvent.httpMethod = 'GET';

      // Act
      const response: any = await main(getEvent, null, null);

      // Assert
      expect(response.statusCode, 'Call Return Status Code').to.eq(200);
    });

    /**
     * Get List
     */
    it('should get a list of batches', async function () {
      // Arrange
      const getEvent = { ...event };
      getEvent.httpMethod = 'GET';
      getEvent.path = '/lockbox/v1/list';

      // Act
      const response: any = await main(getEvent, null, null);
      const resBody = JSON.parse(response.body);

      // Assert
      expect(response.statusCode, 'Call Return Status Code').to.eq(200);

      expect(resBody.batches, 'length').to.length(1);
    });

    /**
     * Update Note
     */
    it('should update the note', async function () {
      // Arrange
      const noteEvent = { ...event };
      noteEvent.httpMethod = 'POST';
      noteEvent.path = '/lockbox/v1/00000000-0000-0000-0000-000000000005_2020122100001/transaction/2021000010002/note';
      noteEvent.body = JSON.stringify({ note: 'New note' });

      // Act
      const response: any = await main(noteEvent, null, null);
      const resBody = JSON.parse(response.body);

      // Assert
      expect(response.statusCode, 'Call Return Status Code').to.eq(200);

      expect(resBody.note, 'note').to.equal('New note');
    });

    /**
     * Get Transaction
     */
    it('should get a transaction', async function () {
      // Arrange
      const getEvent = { ...event };
      getEvent.httpMethod = 'GET';
      getEvent.path = '/lockbox/v1/00000000-0000-0000-0000-000000000005_2020122100001/transaction/2021000010002';

      // Act
      const response: any = await main(getEvent, null, null);
      const resBody = JSON.parse(response.body);

      // Assert
      expect(response.statusCode, 'Call Return Status Code').to.eq(200);

      expect(resBody.transactionId, 'transactionId').to.equal('2021000010002');
    });

    /**
     * Approve action
     */
    it('should approve transaction', async function () {
      // Arrange
      const putEvent = { ...event };
      putEvent.httpMethod = 'POST';
      putEvent.path = '/lockbox/v1/00000000-0000-0000-0000-000000000005_2020122100001/transaction/2021000010002/action';
      putEvent.body = JSON.stringify({
        action: 'Approve'
      });

      // Act
      const response: any = await main(putEvent, null, null);
      const resBody = JSON.parse(response.body);

      // Assert
      expect(response.statusCode, 'Call Return Status Code').to.eq(200);

      expect(resBody.status, 'status').to.equal('Approved');
    });

    /**
     * Update action
     */
    it('should update transaction', async function () {
      // Arrange
      const putEvent = { ...event };
      putEvent.httpMethod = 'POST';
      putEvent.path = '/lockbox/v1/00000000-0000-0000-0000-000000000005_2020122100001/transaction/2021000010002/action';
      putEvent.body = JSON.stringify({
        action: 'Update',
        policyNumber: 'NewPolNum',
        amount: 123
      });

      // Act
      const response: any = await main(putEvent, null, null);
      const resBody = JSON.parse(response.body);

      // Assert
      expect(response.statusCode, 'Call Return Status Code').to.eq(200);

      expect(resBody.policyNumber, 'policyNumber').to.equal('NewPolNum');
    });

    /**
     * Release Batch
     */
    // it('should release the batch', async function () {
    //   // Arrange
    //   const putEvent = { ...event };
    //   putEvent.httpMethod = 'POST';
    //   putEvent.path = '/lockbox/v1/00000000-0000-0000-0000-000000000005_2020122100001/release';

    //   // Act
    //   const response: any = await main(putEvent, null, null);
    //   const resBody = JSON.parse(response.body);

    //   // Assert
    //   // expect(response.statusCode, 'Call Return Status Code').to.eq(200);

    //   // expect(resBody.status, 'status').to.equal('Released');
    // });
  });
});
