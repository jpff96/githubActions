require('dotenv').config();
import * as chai from 'chai';
import * as sinon from 'sinon';
import { main } from '../eventHandler';
import { BalanceRepository } from '../../BalanceRepository';
import { BillingRepository } from '../../BillingRepository';
import { Billing } from '../../models/Billing';
import { DisbursementRepository } from '../../../../disbursement/v1/DisbursementRepository';
import { Batch, Disbursement } from '../../../../disbursement/v1/models';
import { ActivityLogProducer } from '../../../../../libs/ActivityLogProducer';
import { ServiceEventProducer } from '../../../../../libs/ServiceEventProducer';

const { expect } = chai;
const sandbox = sinon.createSandbox();

describe('Accounting triggers test', function () {
  this.timeout(2000);

  after(() => {
    sandbox.restore();
  });

  before(() => {
    const mockBatch = new Batch({
      pk: '00000000-0000-0000-0000-000000000005_20210403AM',
      batchNumber: '20210403AM'
    });

    const mockBilling = new Billing();

    sandbox.replace(
      BillingRepository.prototype,
      'get',
      (): Promise<any> => Promise.resolve(mockBilling)
    );

    sandbox.replace(
      BillingRepository.prototype,
      'saveInvoice',
      (): Promise<any> => Promise.resolve(mockBilling)
    );

    sandbox.replace(
      BillingRepository.prototype,
      'getInvoicesByStatus',
      (): Promise<any> => Promise.resolve([])
    );

    sandbox.replace(
      BillingRepository.prototype,
      'getNextInvoiceNumber',
      (): Promise<any> => Promise.resolve(1)
    );

    sandbox.replace(
      BillingRepository.prototype,
      'save',
      (): Promise<any> => Promise.resolve(mockBilling)
    );

    sandbox.replace(
      DisbursementRepository.prototype,
      'getRecord',
      (recordId: string, docType: DisbursementRepository.BatchRecordType): Promise<any> => Promise.resolve()
    );

    sandbox.replace(
      DisbursementRepository.prototype,
      'saveBatch',
      (batch: Batch, batchType: DisbursementRepository.BatchRecordType): Promise<Batch> => Promise.resolve(mockBatch)
    );

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
      BalanceRepository.prototype,
      'createTransaction',
      (): Promise<any> => Promise.resolve()
    );

    sandbox.replace(
      BalanceRepository.prototype,
      'getTransactions',
      (): Promise<any> => Promise.resolve([])
    );

    sandbox.replace(
      ServiceEventProducer,
      'sendServiceEvent',
      (policyId: string, template: string, properties: any = {}) => Promise.resolve()
    );

    sandbox.replace(
      ActivityLogProducer,
      'sendActivityLog',
      () => Promise.resolve()
    );
  });

  context('eventHandler', () => {
    it('PolicyCanceledRefund', async () => {
      const event: any = {
        version: '0',
        id: '6e3b7688-ca19-2582-d279-c4facbc0dfd2',
        'detail-type': 'PolicyCanceledRefund',
        source: 'api.documents',
        account: '200159443319',
        region: 'us-west-2',
        time: '2020-05-29T00:48:42Z',
        resources: [],
        detail: {
          refund: {
            lineItems: [],
            policyNumber: 'OH-000000529'
          },
          balanceDue: {
            balanceType: 'Refund',
            subtotal: -1111.23,
            dueDate: '',
            description: 'Refund on policy cancel',
            version: '1',
            lineItems: [{
              amount: -1111.23,
              itemType: 'Premium',
              account: 'Main',
              writingCompany: 'FPIC'
            }],
            effectiveDate: '2021-04-15',
            policyNumber: 'TESTPOLNUM'
          },
          recipient: {
            email: 'john@user.com',
            firstName: 'John',
            lastName: 'Smith',
            address: {
              city: 'Sarasota',
              line1: '773 Benjamin Franklin Dr',
              postalCode: '34236-2007',
              state: 'FL'
            },
            isDefaultRecipient: true,
            partyType: 'Consumer'
          },
          key: {
            entityId: '00000000-0000-0000-0000-000000000005',
            policyId: '00000000-0000-0000-0000-000000000005_TESTPOLNUM',
            transEffectiveDate: '2021-04-15',
            termEffectiveDate: '2021-03-01',
            termExpirationDate: '2022-03-01',
            productKey: 'OpenHouse Choice Florida'
          }
        }
      };

      const response = await main(event);
      console.log('it ~ response', response);

      expect(response, 'response').to.eq(undefined);
    });

    it('ProcessedRefund', async () => {
      const event: any = {
        version: '0',
        id: 'd921a323-f368-f929-6b26-4dc2d40bcc79',
        'detail-type': 'ProcessedRefund',
        source: 'api.policy',
        account: '200159443319',
        time: '2021-12-22T12:24:50Z',
        region: 'us-west-2',
        resources: [],
        detail: {
          payments: [
            {
              amount: 88.62,
              costType: 'PremiumRefund',
              deliveryMethod: 'Standard',
              disbursementType: 'Disbursement',
              lineItems: [
                {
                  amount: 0.62,
                  itemType: 'Fee',
                  account: 'FIGA',
                  writingCompany: 'FPIC'
                },
                {
                  amount: 88,
                  itemType: 'Premium',
                  account: 'Main',
                  writingCompany: 'FPIC'
                }
              ],
              mailingAddress: {
                line1: '13024 Pechora Ct',
                line2: ' ',
                city: 'Jacksonville',
                state: 'FL',
                postalCode: '32246',
                stateCode: '',
                countryCode: ''
              },
              policyId: '00000000-0000-0000-0000-000000000005_OH-000000529',
              policyNumber: 'OH-000000529',
              productKey: 'OpenHouse Choice Florida',
              recipients: [
                {
                  address: {
                    line1: '13024 Pechora Ct',
                    line2: ' ',
                    city: 'Jacksonville',
                    state: 'FL',
                    postalCode: '32246',
                    stateCode: '',
                    countryCode: ''
                  },
                  email: 'bbrizolara@codigodelsur.com',
                  firstName: 'Bruno',
                  lastName: 'Brizolara',
                  isDefaultRecipient: true,
                  partyType: 'Consumer',
                  phoneNumber: '(099) 057-5863'
                }
              ],
              referenceId: '00000000-0000-0000-0000-000000000005_OH-000000529',
              referenceNumber: 'OH-000000529',
              referenceType: 'Policy',
              shippingEmail: 'bbrizolara@codigodelsur.com',
              shippingFirstName: 'Bruno',
              shippingLastName: 'Brizolara',
              reason: 'PolicyChange'
            }
          ],
          key: {
            entityId: '00000000-0000-0000-0000-000000000005',
            principalId: 'e2435c49-c044-4950-b6e7-edddf0536b3f',
            writingCompanyEntityId: '00000000-0000-0000-0000-000000000002',
            policyId: '00000000-0000-0000-0000-000000000005_OH-000000529',
            formType: 'DP2',
            state: 'FL',
            referenceId: '00000000-0000-0000-0000-000000000005_OH-000000529',
            version: '2',
            termEffectiveDate: '2022-01-05'
          }
        }
      };

      const response = await main(event);
      console.log('it ~ response', response);

      expect(response, 'response').to.eq(undefined);
    });
  });
});
