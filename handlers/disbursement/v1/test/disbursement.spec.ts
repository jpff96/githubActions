require('dotenv').config();
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as chai from 'chai';
import * as sinon from 'sinon';
import { DisbursementRepository, IGetBatchListFilters, IGetDisbursementsFilters } from '../DisbursementRepository';
import { BillingRepository } from '../../../accounting/v1/BillingRepository';
import { Billing } from '../../../accounting/v1/models/Billing';
import { main } from '../main';
import {
  Batch,
  BatchList,
  Disbursement,
  DisbursementHistory,
  DisbursementState,
  OutgoingDocument,
  BatchResponse
} from '../models';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { IEventDetail } from '../../../../libs/IEventDetail';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { ProductAPI } from '../../../../libs/API/ProductAPI';

const { expect } = chai;
const sandbox = sinon.createSandbox();

/**
 * Creates a new mock event for testing
 * @param path        Event path
 * @param body        Event body
 * @param httpMethod  Event http method to use
 *
 * @returns APIGatewayProxyEvent
 */
const createEvent = (path: string, body?: any, queryStringParameters?: any, httpMethod: string = 'GET') =>
(({
  headers: {
    origin: 'http://local-commandcenter.openhouseinsurance.com:3000',
    'content-type': 'application/json'
  },
  httpMethod,
  path,
  body: body ? JSON.stringify(body) : undefined,
  queryStringParameters,
  requestContext: {
    identity: {
      cognitoAuthenticationProvider: 'XYZ:cognitoIdentityId-USER-1234'
    },
    authorizer: {
      tenantId: '00000000-0000-0000-0000-000000000005',
      principalId: 'Cognito_auth_id',
      email: 'test@test.com'
    }
  }
} as unknown) as APIGatewayProxyEvent);

const defaultPath = '/disbursement/v1';
const disbursementState = new DisbursementState({ state: 'Pending', updatedDateTime: '2021-09-29T12:38:52.771Z' });

const mockDisbursement = new Disbursement({
  pk: '00000000-0000-0000-0000-000000000005_51',
  sk: 'ClaimDisbursement',
  policyId: '00000000-0000-0000-0000-000000000005_TESTPOLNUM',
  disbursementHistory: [new DisbursementHistory(disbursementState)],
  disbursementNumber: '51',
  documentKeyList: [
    'documents/clients/00000000-0000-0000-0000-000000000005/completed/1632402129047_00000000-0000-0000-0000-000000000005.pdf'
  ],
  lastActionBy: 'test@test.com',
  lastActionDate: '2021-07-08',
  mailingAddress: { city: 'Miami', line1: '1233 Fake Street', postalCode: '123', state: 'Florida' },
  recipients: [{ isDefaultRecipient: true, firstName: 'John', lastName: 'Doe' }],
  referenceId: '00000000-0000-0000-0000-000000000005_POL_NUM',
  referenceNumber: '123',
  referenceType: 'Claim',
  rejectReason: 'Invalid payment',
  state: disbursementState,
  trackingNumber: '123'
});

const mockDisbursements: Disbursement[] = [mockDisbursement];

const mockBatch = new Batch({
  pk: '00000000-0000-0000-0000-000000000005_20210403AM',
  batchNumber: '20210403AM'
});

const mockDisbursementList = {
  lastEvaluatedKey: null,
  disbursements: mockDisbursements
};

const mockBatchList = new BatchList({ key: '123' }, [
  new BatchResponse({ pk: '00000000-0000-0000-0000-000000000005_17223' })
]);

const mockBilling = new Billing({
  pk: '00000000-0000-0000-0000-000000000005_TESTPOLNUM',
  agencyEntityId: '00000000-0000-0000-0000-000000000005'
});

const productDefinition = [
  {},
  {
    reservePaymentInfoList: [
      {
        accountingName: 'DPX D&CC CAT - Hurricane',
        configName: 'ExpenseDefenseAndCostContainment',
        name: 'Expense - D&CC',
        account: 'FIMI',
        catastrophes: ['Hurricane']
      },
      {
        accountingName: 'Zero Payment (Printing)',
        configName: 'ZeroPayment',
        name: 'Zero Payment (Printing)',
        account: 'FPIC_RP',
        catastrophes: []
      }
    ]
  }
]

describe('Disbursement Tests', function () {
  this.timeout(20000);

  after(async () => {
    sandbox.restore();
  });

  before(() => {
    sandbox.replace(
      DisbursementRepository.prototype,
      'saveDisbursement',
      (
        disbursement: Disbursement,
        disbursementType: DisbursementRepository.DisbursementRecordType
      ): Promise<Disbursement> => {
        const savedDisbursement = new Disbursement(disbursement);
        savedDisbursement.pk = '00000000-0000-0000-0000-000000000005_51';
        savedDisbursement.sk = disbursementType;
        savedDisbursement.lastActionDate = '2021-07-08';
        savedDisbursement.createdDateTime = '2021-04-28T20:32:46.315Z';
        savedDisbursement.disbursementNumber = '51';
        savedDisbursement.docTypeNumber = 'ClaimDisbursement_000000051';

        return Promise.resolve(savedDisbursement);
      }
    );

    sandbox.replace(
      DisbursementRepository.prototype,
      'getDisbursement',
      (
        disbursementId: string,
        disbursementType: DisbursementRepository.DisbursementRecordType
      ): Promise<Disbursement> => Promise.resolve(new Disbursement(mockDisbursement))
    );

    sandbox.replace(
      DisbursementRepository.prototype,
      'getBatchById',
      (
        batchId: string,
        batchType: DisbursementRepository.BatchRecordType
      ): Promise<BatchResponse> => Promise.resolve(new BatchResponse({ pk: '00000000-0000-0000-0000-000000000005_17223' }))
    );

    sandbox.replace(
      DisbursementRepository.prototype,
      'getRecord',
      (recordId: string, docType: DisbursementRepository.BatchRecordType): Promise<Batch> => Promise.resolve(mockBatch)
    );

    sandbox.replace(
      DisbursementRepository.prototype,
      'getBatchList',
      (
        entityId: string,
        batchType: DisbursementRepository.DisbursementRecordType,
        filters: IGetBatchListFilters,
        take: number,
        lastEvaluatedKey: string
      ): Promise<BatchList> => Promise.resolve(mockBatchList)
    );

    sandbox.replace(
      DisbursementRepository.prototype,
      'getDisbursementList',
      (
        entityId: string,
        disbursementType: DisbursementRepository.DisbursementRecordType,
        filters: IGetDisbursementsFilters,
        take: number,
        lastEvaluatedKey: string
      ): Promise<any> => Promise.resolve(mockDisbursementList)
    );

    sandbox.replace(
      DisbursementRepository.prototype,
      'getDisbursements',
      (batchId: string, filters: IGetDisbursementsFilters): Promise<Disbursement[]> =>
        Promise.resolve(mockDisbursements)
    );

    sandbox.replace(
      DisbursementRepository.prototype,
      'saveBatch',
      (batch: Batch, batchType: DisbursementRepository.BatchRecordType): Promise<Batch> => Promise.resolve(mockBatch)
    );

    sandbox.replace(
      ActivityLogProducer,
      'sendActivityLog',
      (policyId: string, agencyEntityId: string, template: string, properties: any = {}) => Promise.resolve()
    );

    sandbox.replace(
      ServiceEventProducer,
      'sendServiceEvent',
      (policyId: string, template: string, properties: any = {}) => Promise.resolve()
    );

    sandbox.replace(
      ProductAPI,
      'getConfiguration',
      (productKey: string) => Promise.resolve(productDefinition)
    );

    sandbox.replace(
      BillingRepository.prototype,
      'get',
      (policyId: string) => Promise.resolve(mockBilling)
    );
  });

  context('Lambda context', () => {
    it('Should create a new disbursement', async () => {
      const body = {
        amount: 700,
        approvalBy: 'gfleitas@codigodelsur.com',
        approvalDateTime: '2021-04-21T15:47:45.710Z',
        catastropheType: 'Hurricane',
        costType: 'ExpenseDefenseAndCostContainment',
        coverage: 'PropertyOtherStructures',
        deliveryMethod: 'Standard',
        description: 'Payment for claim',
        disbursementType: 'ClaimDisbursement',
        documentKeyList: ['documents/clients/undefined/uploaded/1619705051350.pdf'],
        lossDateTime: '2021-04-20T15:47:45.710Z',
        mailingAddress: {
          line1: '773 Benjamin Franklin Dr',
          city: 'Sarasota',
          state: 'FL',
          postalCode: '34236-2007'
        },
        paymentId: 'PAYMENT_110',
        paymentDetailList: [
          {
            amount: 1000,
            coverageType: 'PropertyDwelling',
            type: 'LossAmount'
          },
          {
            amount: -100,
            coverageType: 'PropertyDwelling',
            type: 'Deductible'
          },
          {
            amount: -200,
            coverageType: 'PropertyDwelling',
            type: 'RecoverableDepreciationWithheld'
          }
        ],
        policyId: '00000000-0000-0000-0000-000000000005_TESTPOLNUM',
        policyNumber: 'OH-000000522',
        productKey: 'OpenHouse Choice Florida',
        recipients: [
          {
            address: {
              city: 'Sarasota',
              line1: '773 Benjamin Franklin Dr',
              postalCode: '34236-2007',
              state: 'FL'
            },
            email: 'recipient@user.com',
            firstName: 'John',
            lastName: 'Smith',
            isDefaultRecipient: true,
            partyType: 'Consumer',
            phoneNumber: '5555-5555'
          },
          {
            address: {
              city: 'Rome',
              county: 'Duval',
              line1: '3729 Martha Berry Hwy',
              postalCode: '30165',
              state: 'GA'
            },
            companyName: 'Puroclean Restoration Cleaning',
            email: 'dspierto@puroclean.com',
            governmentIdNumber: '11-1111111',
            governmentIdType: 'EIN',
            isDefaultRecipient: false,
            partyType: 'Business',
            phoneNumber: '4444-4444'
          }
        ],
        referenceId: '00000000-0000-0000-0000-000000000005_TESTPOLNUMC1',
        referenceNumber: 'OH-000000522C1',
        referenceType: 'Claim',
        returnEvent: 'ClaimDisbursementCreated',
        shippingEmail: 'recipient@user.com',
        shippingFirstName: 'John',
        shippingLastName: 'Smith'
      };

      const event = createEvent(defaultPath, body, null, 'POST');
      const response = (await main(event, null, null)) as APIGatewayProxyResult;

      expect(response.statusCode, 'statusCode').to.eq(200);

      const parsedResponse = JSON.parse(response.body);
      const disbursement: Disbursement = parsedResponse[0];
      const { mailingAddress, paymentDetailList, recipients } = disbursement;
      const paymentDetail = paymentDetailList[0];
      const recipient = recipients[0];

      expect(disbursement.pk, 'pk').to.eq('00000000-0000-0000-0000-000000000005_51');
      expect(disbursement.sk, 'sk').to.eq('ClaimDisbursement');
      expect(disbursement.amount, 'amount').to.eq(700);
      expect(disbursement.approvalBy, 'approvalBy').to.eq('gfleitas@codigodelsur.com');
      expect(disbursement.approvalDateTime, 'approvalDateTime').to.eq('2021-04-21T15:47:45.710Z');
      expect(disbursement.batchId, 'batchId').to.eq('00000000-0000-0000-0000-000000000005_20210403AM');
      expect(disbursement.catastropheType, 'catastropheType').to.eq('Hurricane');
      expect(disbursement.costType, 'costType').to.eq('ExpenseDefenseAndCostContainment');
      expect(disbursement.coverage, 'coverage').to.eq('PropertyOtherStructures');
      expect(disbursement.createdDateTime, 'createdDateTime').to.eq('2021-04-28T20:32:46.315Z');
      expect(disbursement.deliveryMethod, 'deliveryMethod').to.eq('Standard');
      expect(disbursement.description, 'description').to.eq('Payment for claim');
      expect(disbursement.disbursementNumber, 'disbursementNumber').to.eq('51');
      expect(disbursement.docTypeNumber, 'docTypeNumber').to.eq('ClaimDisbursement_000000051');
      expect(disbursement.documentKeyList[0], 'documentKeyList[0]').to.eq(
        'documents/clients/undefined/uploaded/1619705051350.pdf'
      );
      expect(disbursement.entityId, 'entityId').to.eq('00000000-0000-0000-0000-000000000005');
      expect(disbursement.lossDateTime, 'lossDateTime').to.eq('2021-04-20T15:47:45.710Z');
      expect(disbursement.policyId, 'policyId').to.eq('00000000-0000-0000-0000-000000000005_TESTPOLNUM');
      expect(disbursement.policyNumber, 'policyNumber').to.eq('OH-000000522');
      expect(disbursement.productKey, 'productKey').to.eq('OpenHouse Choice Florida');
      expect(disbursement.referenceId, 'referenceId').to.eq('00000000-0000-0000-0000-000000000005_TESTPOLNUMC1');
      expect(disbursement.referenceNumber, 'referenceNumber').to.eq('OH-000000522C1');
      expect(disbursement.referenceType, 'referenceType').to.eq('Claim');
      expect(disbursement.shippingEmail, 'shippingEmail').to.eq('recipient@user.com');
      expect(disbursement.shippingFirstName, 'shippingFirstName').to.eq('John');
      expect(disbursement.shippingLastName, 'shippingLastName').to.eq('Smith');
      expect(disbursement.state.state, 'state').to.eq('Approved');

      expect(paymentDetail.amount, 'paymentDetail.amount').to.eq(1000);
      expect(paymentDetail.coverageType, 'paymentDetail.coverageType').to.eq('PropertyDwelling');
      expect(paymentDetail.type, 'paymentDetail.type').to.eq('LossAmount');

      expect(recipient.address.city, 'recipient.address.city').to.eq('Sarasota');
      expect(recipient.address.line1, 'recipient.address.line1').to.eq('773 Benjamin Franklin Dr');
      expect(recipient.address.postalCode, 'recipient.address.postalCode').to.eq('34236-2007');
      expect(recipient.address.state, 'recipient.address.state').to.eq('FL');
      expect(recipient.email, 'recipient.email').to.eq('recipient@user.com');
      expect(recipient.firstName, 'recipient.firstName').to.eq('John');
      expect(recipient.lastName, 'recipient.lastName').to.eq('Smith');
      expect(recipient.partyType, 'recipient.partyType').to.eq('Consumer');

      expect(mailingAddress.line1, 'mailingAddress.line1').to.eq('773 Benjamin Franklin Dr');
      expect(mailingAddress.city, 'mailingAddress.city').to.eq('Sarasota');
      expect(mailingAddress.state, 'mailingAddress.state').to.eq('FL');
      expect(mailingAddress.postalCode, 'mailingAddress.postalCode').to.eq('34236-2007');
    });

    it('Should create a list of disbursement (DisbursementPrint with multiple recipients)', async () => {
      const body = {
        amount: 0,
        costType: 'ZeroPayment',
        disbursementType: 'DisbursementPrint',
        documentKeyList: ['documents/clients/undefined/uploaded/1619705051350.pdf'],
        mailingAddress: {
          line1: '773 Benjamin Franklin Dr',
          city: 'Sarasota',
          state: 'FL',
          postalCode: '34236-2007'
        },
        policyId: '00000000-0000-0000-0000-000000000005_TESTPOLNUM',
        policyNumber: 'OH-000000522',
        productKey: 'OpenHouse Choice Florida',
        recipients: [
          {
            address: {
              city: 'Sarasota',
              line1: '773 Benjamin Franklin Dr',
              postalCode: '34236-2007',
              state: 'FL'
            },
            email: 'recipient@user.com',
            firstName: 'John',
            lastName: 'Smith',
            isDefaultRecipient: true,
            partyType: 'Consumer',
            phoneNumber: '5555-5555'
          },
          {
            address: {
              city: 'Rome',
              county: 'Duval',
              line1: '3729 Martha Berry Hwy',
              postalCode: '30165',
              state: 'GA'
            },
            companyName: 'Puroclean Restoration Cleaning',
            email: 'dspierto@puroclean.com',
            governmentIdNumber: '11-1111111',
            governmentIdType: 'EIN',
            isDefaultRecipient: false,
            partyType: 'Business',
            phoneNumber: '4444-4444'
          }
        ],
        referenceId: '00000000-0000-0000-0000-000000000005_TESTPOLNUMC1',
        referenceNumber: 'OH-000000522C1',
        referenceType: 'Claim',
        shippingEmail: 'recipient@user.com',
        shippingFirstName: 'John',
        shippingLastName: 'Smith'
      };

      const event = createEvent(defaultPath, body, null, 'POST');
      const response = (await main(event, null, null)) as APIGatewayProxyResult;

      expect(response.statusCode, 'statusCode').to.eq(200);

      const parsedResponse = JSON.parse(response.body);
      const disbursementList: Array<Disbursement> = parsedResponse;

      expect(disbursementList.length, 'disbursementList.length').to.eq(2);

      const disbursement = disbursementList[0];
      const { mailingAddress, recipients } = disbursement;
      const recipient = recipients[0];
      const secondDisbursement = disbursementList[1];
      const secondRecipient = secondDisbursement.recipients[0];
      const secondMailingAddress = secondDisbursement.mailingAddress;

      expect(disbursementList.length, 'disbursementList.length').to.eq(2);

      expect(disbursement.pk, 'pk').to.eq('00000000-0000-0000-0000-000000000005_51');
      expect(disbursement.sk, 'sk').to.eq('DisbursementPrint');
      expect(disbursement.amount, 'amount').to.eq(0);
      expect(disbursement.batchId, 'batchId').to.eq('00000000-0000-0000-0000-000000000005_20210403AM');
      expect(disbursement.costType, 'costType').to.eq('ZeroPayment');
      expect(disbursement.createdDateTime, 'createdDateTime').to.eq('2021-04-28T20:32:46.315Z');
      expect(disbursement.disbursementNumber, 'disbursementNumber').to.eq('51');
      expect(disbursement.docTypeNumber, 'docTypeNumber').to.eq('ClaimDisbursement_000000051');
      expect(disbursement.documentKeyList[0], 'documentKeyList[0]').to.eq('documents/clients/undefined/uploaded/1619705051350.pdf');
      expect(disbursement.entityId, 'entityId').to.eq('00000000-0000-0000-0000-000000000005');
      expect(disbursement.policyId, 'policyId').to.eq('00000000-0000-0000-0000-000000000005_TESTPOLNUM');
      expect(disbursement.policyNumber, 'policyNumber').to.eq('OH-000000522');
      expect(disbursement.productKey, 'productKey').to.eq('OpenHouse Choice Florida');
      expect(disbursement.referenceId, 'referenceId').to.eq('00000000-0000-0000-0000-000000000005_TESTPOLNUMC1');
      expect(disbursement.referenceNumber, 'referenceNumber').to.eq('OH-000000522C1');
      expect(disbursement.referenceType, 'referenceType').to.eq('Claim');
      expect(disbursement.shippingEmail, 'shippingEmail').to.eq('recipient@user.com');
      expect(disbursement.shippingFirstName, 'shippingFirstName').to.eq('John');
      expect(disbursement.shippingLastName, 'shippingLastName').to.eq('Smith');
      expect(disbursement.state.state, 'state').to.eq('Approved');

      expect(recipient.address.city, 'recipient.address.city').to.eq('Sarasota');
      expect(recipient.address.line1, 'recipient.address.line1').to.eq('773 Benjamin Franklin Dr');
      expect(recipient.address.postalCode, 'recipient.address.postalCode').to.eq('34236-2007');
      expect(recipient.address.state, 'recipient.address.state').to.eq('FL');
      expect(recipient.email, 'recipient.email').to.eq('recipient@user.com');
      expect(recipient.firstName, 'recipient.firstName').to.eq('John');
      expect(recipient.lastName, 'recipient.lastName').to.eq('Smith');
      expect(recipient.isDefaultRecipient, 'recipient.isDefaultRecipient').to.eq(true);

      expect(secondRecipient.address.city, 'secondRecipient.address.city').to.eq('Rome');
      expect(secondRecipient.address.line1, 'secondRecipient.address.line1').to.eq('3729 Martha Berry Hwy');
      expect(secondRecipient.address.postalCode, 'secondRecipient.address.postalCode').to.eq('30165');
      expect(secondRecipient.address.state, 'secondRecipient.address.state').to.eq('GA');
      expect(secondRecipient.isDefaultRecipient, 'secondRecipient.isDefaultRecipient').to.eq(true);

      expect(mailingAddress.city, 'mailingAddress.city').to.eq('Sarasota');
      expect(mailingAddress.line1, 'mailingAddress.line1').to.eq('773 Benjamin Franklin Dr');
      expect(mailingAddress.postalCode, 'mailingAddress.postalCode').to.eq('34236-2007');
      expect(mailingAddress.state, 'mailingAddress.state').to.eq('FL');

      expect(secondMailingAddress.city, 'secondMailingAddress.city').to.eq('Rome');
      expect(secondMailingAddress.line1, 'secondMailingAddress.line1').to.eq('3729 Martha Berry Hwy');
      expect(secondMailingAddress.postalCode, 'secondMailingAddress.postalCode').to.eq('30165');
      expect(secondMailingAddress.state, 'secondMailingAddress.state').to.eq('GA');
    });

    it('Should change a disbursement state', async () => {
      const path = `${defaultPath}/00000000-0000-0000-0000-000000000005_1302/action`;
      const body = {
        action: 'Reject',
        disbursementType: 'ClaimDisbursement',
        rejectReason: 'Invalid payment',
        paymentId: 'PAYMENT_110',
        returnEvent: 'ClaimDisbursementStateChanged'
      };

      const event = createEvent(path, body, null, 'POST');
      const response = (await main(event, null, null)) as APIGatewayProxyResult;

      expect(response.statusCode, 'statusCode').to.eq(200);

      const parsedResponse = JSON.parse(response.body);
      const disbursement: Disbursement = parsedResponse;

      expect(disbursement.pk, 'pk').to.eq('00000000-0000-0000-0000-000000000005_51');
      expect(disbursement.sk, 'sk').to.eq('ClaimDisbursement');
      expect(disbursement.lastActionBy, 'lastActionBy').to.eq('test@test.com');
      expect(disbursement.lastActionDate, 'lastActionDate').to.eq('2021-07-08');
      expect(disbursement.rejectReason, 'rejectReason').to.eq('Invalid payment');
      expect(disbursement.state.state, 'state').to.eq('Rejected');
    });

    it('Should get the outgoing documents', async () => {
      const path = `${defaultPath}/outgoingDocuments`;
      const queryStringParameters = {
        take: 15,
        lastEvaluatedKey: null
      };

      const event = createEvent(path, null, queryStringParameters, 'GET');
      const response = (await main(event, null, null)) as APIGatewayProxyResult;
      const { statusCode, body } = response;
      const outgoingDocument: OutgoingDocument = JSON.parse(body).outgoingDocuments[0];
      const {
        id,
        referenceNumber,
        referenceType,
        mailingAddress,
        createdDateTime,
        status,
        deliveryMethod,
        recipientFirstName,
        recipientLastName,
        documentHistory,
        documentKey,
        referenceId,
        trackingNumber
      } = outgoingDocument;

      expect(statusCode, 'statusCode').to.eq(200);

      expect(id, 'id').to.be.eq('51_0');
      expect(referenceNumber, 'referenceNumber').to.be.eq('123');
      expect(referenceType, 'referenceType').to.be.eq('Claim');
      expect(referenceId, 'referenceId').to.be.eq('00000000-0000-0000-0000-000000000005_POL_NUM');
      expect(mailingAddress.city, 'mailingAddress.city').to.be.eq('Miami');
      expect(createdDateTime, 'createdDateTime').to.be.eq('');
      expect(status.state, 'status.state').to.be.eq('Pending');
      expect(deliveryMethod, 'deliveryMethod').to.be.eq('Standard');
      expect(recipientFirstName, 'recipientFirstName').to.be.eq('John');
      expect(recipientLastName, 'recipientLastName').to.be.eq('Doe');
      expect(documentHistory[0].state, 'documentHistory[0].state').to.be.eq('Pending');
      expect(trackingNumber, 'trackingNumber').to.be.eq('123');
      expect(documentKey, 'documentKey').to.be.eq(
        'documents/clients/00000000-0000-0000-0000-000000000005/completed/1632402129047_00000000-0000-0000-0000-000000000005.pdf'
      );
    });

    it('Should move disbursement to next batch', async () => {
      const path = `${defaultPath}/00000000-0000-0000-0000-000000000005_1302/action`;
      const body = {
        action: 'MoveBatch',
        disbursementType: ''
      };

      const event = createEvent(path, body, null, 'POST');
      const response = (await main(event, null, null)) as APIGatewayProxyResult;

      expect(response.statusCode, 'statusCode').to.eq(200);

      const parsedResponse = JSON.parse(response.body);
      const disbursement: Disbursement = parsedResponse;

      expect(disbursement.pk, 'pk').to.eq('00000000-0000-0000-0000-000000000005_51');
      expect(disbursement.sk, 'sk').to.eq('Disbursement');
      expect(disbursement.lastActionBy, 'lastActionBy').to.eq('test@test.com');
      expect(disbursement.lastActionDate, 'lastActionDate').to.eq('2021-07-08');
      expect(disbursement.state.state, 'state').to.eq('Approved');
    });

    it('Should get a list of batches', async () => {
      const path = `${defaultPath}/batch/list`;
      const queryStringParameters = {
        batchType: 'Batch',
        returnDisbursements: false
      };

      const event = createEvent(path, null, queryStringParameters, 'GET');
      const response = (await main(event, null, null)) as APIGatewayProxyResult;
      const { statusCode, body } = response;
      const batchList: BatchList = JSON.parse(body);
      const { lastEvaluatedKey, batches } = batchList;

      expect(statusCode, 'statusCode').to.eq(200);

      expect(lastEvaluatedKey.key, 'key').to.be.eq('123');
      expect(batches[0].pk, 'batches[0].pk').to.be.eq('00000000-0000-0000-0000-000000000005_17223');
      expect(batches[0].disbursements, 'batches[0].disbursements').to.be.undefined;
    });

    it('Should get a list of Disbursements', async () => {
      const path = `${defaultPath}/batch/list`;
      const queryStringParameters = {
        batchType: 'Batch',
        returnDisbursements: true,
        disbursementState: 'Pending',
        lastEvaluatedKey: null,
        batchStateFilter: 'None',
        take: 15
      };

      const event = createEvent(path, null, queryStringParameters, 'GET');
      const response = (await main(event, null, null)) as APIGatewayProxyResult;
      const { statusCode, body } = response;
      const disbursementList = JSON.parse(body);

      expect(statusCode, 'statusCode').to.eq(200);

      expect(disbursementList.disbursements[0].disbursementId, 'disbursementList.disbursements[0].disbursementId').to.be.eq(
        '00000000-0000-0000-0000-000000000005_51'
      );
      expect(disbursementList.disbursements[0].state.state, 'disbursementList.disbursements[0].state.state').to.be.eq('Pending');
    });
  });
});
