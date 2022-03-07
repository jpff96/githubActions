require('dotenv').config();
import * as chai from 'chai';
import * as sinon from 'sinon';
import { DisbursementRepository } from '../DisbursementRepository';
import { main } from '../handlers/eventHandler';
import { Batch, Disbursement } from '../models';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';
import { ValidationError } from '../../../../libs/errors';
import { BillingRepository } from '../../../accounting/v1/BillingRepository';
import { Billing } from '../../../accounting/v1/models/Billing';

const { expect } = chai;
const sandbox = sinon.createSandbox();

const mockDisbursement = new Disbursement({
  pk: '00000000-0000-0000-0000-000000000005_17',
  sk: 'ClaimDisbursement',
  lastActionBy: 'test@test.com',
  lastActionDate: '2021-07-08',
  rejectReason: 'Invalid payment',
  state: 'Reject',
  policyId: '00000000-0000-0000-0000-000000000005_TESTPOLNUM',
});

const mockBatch = new Batch({ 
  pk: '00000000-0000-0000-0000-000000000005_20210403AM',
  batchNumber: '20210403AM'
});

const mockBilling = new Billing({
  pk: '00000000-0000-0000-0000-000000000005_TESTPOLNUM',
  agencyEntityId: '00000000-0000-0000-0000-000000000005'
});

describe('Disbursement EventHandler test', function () {
  this.timeout(20000);

  after(() => {
    sandbox.restore();
  });

  before(() => {
    sandbox.replace(
      DisbursementRepository.prototype,
      'getDisbursement',
      (
        disbursementId: string,
        disbursementType: DisbursementRepository.DisbursementRecordType
      ): Promise<Disbursement> => Promise.resolve(mockDisbursement)
    );

    sandbox.replace(
      DisbursementRepository.prototype,
      'saveDisbursement',
      (
        disbursement: Disbursement,
        disbursementType: DisbursementRepository.DisbursementRecordType
      ): Promise<Disbursement> => Promise.resolve(disbursement)
    );

    sandbox.replace(
      ServiceEventProducer,
      'sendServiceEvent',
      (policyId: string, template: string, properties: any = {}) => Promise.resolve()
    );

    sandbox.replace(
      ActivityLogProducer,
      'sendActivityLog',
      (policyId: string, agencyEntityId: string, template: string, properties: any = {}) => Promise.resolve()
    );

    sandbox.replace(
      DisbursementRepository.prototype,
      'getRecord',
      (
        recordId: string,
        docType: DisbursementRepository.BatchRecordType
      ): Promise<Batch> => Promise.resolve(mockBatch)
    );

    sandbox.replace(
      BillingRepository.prototype,
      'get',
      (policyId: string) => Promise.resolve(mockBilling)
    );
  });

  context('eventHandler', () => {
    it('ClaimDisbursementRequestEdit', async () => {
      const event: any = {
        version: '0',
        id: '6e3b7688-ca19-2582-d279-c4facbc0dfd2',
        'detail-type': 'ClaimDisbursementRequestEdit',
        source: 'api.claims',
        account: '200159443319',
        region: 'us-west-2',
        time: '2020-05-29T00:48:42Z',
        resources: [],
        detail: {
          disbursementPayload: {
            batchId: '00000000-0000-0000-0000-000000000005_20210705AM',
            batchNumber: '20210705AM',
            disbursementId: '00000000-0000-0000-0000-000000000005_1175',
            disbursementNumber: '1175',
            disbursementType: 'ClaimDisbursement',
            paymentId: 'PAYMENT_109',
            policyId: '00000000-0000-0000-0000-000000000005_TESTPOLNUM',
            recipients: [
              {
                address: {
                  line1: '13024 Pechora Ct',
                  city: 'Jacksonville',
                  state: 'FL',
                  postalCode: '32246'
                },
                email: 'azsdasd@asd.com',
                firstName: 'Juan Ignacio',
                isDefaultRecipient: true,
                lastName: 'Viglianco',
                partyType: 'Consumer'
              }
            ],
            referenceId: '00000000-0000-0000-0000-000000000005_TESTPOLNUMC1',
            referenceNumber: 'TESTPOLNUMC1',
            returnEvent: 'ClaimDisbursementEditResponse'
          },
          key: {
            entityId: '00000000-0000-0000-0000-000000000005',
            policyId: '00000000-0000-0000-0000-000000000005_TESTPOLNUM',
            referenceId: '00000000-0000-0000-0000-000000000005_TESTPOLNUMC1'
          }
        }
      };

      const response = await main(event);

      expect(response, 'response').to.eq(undefined);
    });

    it('RequestDisbursementAction Approve', async () => {
      const event: any = {
        "version": "0",
        "id": "6e3b7688-ca19-2582-d279-c4facbc0dfd2",
        "detail-type": "RequestDisbursementAction",
        "source": "api.policy",
        "account": "200159443319",
        "region": "us-west-2",
        "time": "2020-05-29T00: 48: 42Z",
        "resources": [],
        "detail": {
          "disbursementActionPayload": {
            "disbursementId": "00000000-0000-0000-0000-000000000005_18540",
            "action": "Approve",
            "disbursementType": "Disbursement",
            "paymentId": "PAYMENT_109",
            "rejectReason": "",
            "returnEvent": "RequestDisbursementAction"
          },
          "key": {
            "entityId": "00000000-0000-0000-0000-000000000005"
          }
        }
      }

      const response = await main(event);
      expect(response, 'response').to.eq(undefined);
    });

    it('RequestDisbursementAction Reject', async () => {
      const event: any = {
        "version": "0",
        "id": "6e3b7688-ca19-2582-d279-c4facbc0dfd2",
        "detail-type": "RequestDisbursementAction",
        "source": "api.policy",
        "account": "200159443319",
        "region": "us-west-2",
        "time": "2020-05-29T00: 48: 42Z",
        "resources": [],
        "detail": {
          "disbursementActionPayload": {
            "disbursementId": "00000000-0000-0000-0000-000000000005_18540",
            "action": "Reject",
            "disbursementType": "Disbursement",
            "paymentId": "PAYMENT_109",
            "rejectReason": "",
            "returnEvent": "RequestDisbursementAction"
          },
          "key": {
            "entityId": "00000000-0000-0000-0000-000000000005"
          }
        }
      }

      const response = await main(event);
      expect(response, 'response').to.eq(undefined);
    });
    
    it('RequestDisbursementAction MoveBatch', async () => {
      const event: any = {
        "version": "0",
        "id": "6e3b7688-ca19-2582-d279-c4facbc0dfd2",
        "detail-type": "RequestDisbursementAction",
        "source": "api.policy",
        "account": "200159443319",
        "region": "us-west-2",
        "time": "2020-05-29T00: 48: 42Z",
        "resources": [],
        "detail": {
          "disbursementActionPayload": {
            "disbursementId": "00000000-0000-0000-0000-000000000005_18540",
            "action": "MoveBatch",
            "disbursementType": "Disbursement",
            "paymentId": "PAYMENT_109",
            "rejectReason": "",
            "returnEvent": "RequestDisbursementAction"
          },
          "key": {
            "entityId": "00000000-0000-0000-0000-000000000005"
          }
        }
      }

      const response = await main(event);
      expect(response, 'response').to.eq(undefined);
    });
  });
});
