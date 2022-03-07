require('dotenv').config();
import * as chai from 'chai';
import * as sinon from 'sinon';
import { upload } from '../upload';
import { Disbursement } from '../../../disbursement/v1/models';

const { expect } = chai;
const sandbox = sinon.createSandbox();

describe('vPay Upload Tests', function () {
  this.timeout(20000);

  after(() => {
    sandbox.restore();
  });

  before(() => {});

  context('upload', () => {
    it('call upload', async () => {
      const tenantId = '00000000-0000-0000-0000-000000000005';
      const disbursements = [
        new Disbursement({
          amount: 500,
          approvalBy: 'cgomez@codigodelsur.com',
          approvalDateTime: '2021-08-03T19:50:07.417Z',
          batchId: '00000000-0000-0000-0000-000000000005_20210803AM',
          batchNumber: '20210803AM',
          catastropheType: 'NonHurricaneWind',
          costType: 'ExpenseDefenseAndCostContainment',
          coverage: 'PropertyDwelling',
          createdDateTime: '2021-08-03T19:50:09.443Z',
          disbursementNumber: '16659',
          docTypeNumber: 'ClaimDisbursement_16659',
          documentKeyList: [
            'documents/clients/00000000-0000-0000-0000-000000000005/completed/1628019712432_undefined_00000000-0000-0000-0000-000000000005.pdf',
            'documents/clients/00000000-0000-0000-0000-000000000005/completed/1628019709929_undefined_00000000-0000-0000-0000-000000000005.pdf'
          ],
          entityId: '00000000-0000-0000-0000-000000000005',
          lossDateTime: '2021-07-31T06:00:00.000Z',
          mailingAddress: {
            city: 'Jacksonville',
            countryCode: null,
            county: null,
            countyFIPS: null,
            line1: '13024 Pechora Ct',
            line2: null,
            postalCode: '32246',
            state: 'FL',
            stateCode: null
          },
          paymentDetailList: [
            {
              amount: 500,
              coverageType: 'PropertyDwelling',
              type: 'LossAmount'
            }
          ],
          pk: '00000000-0000-0000-0000-000000000005_16659',
          policyId: '00000000-0000-0000-0000-000000000005_OH-000002379',
          policyNumber: 'OH-000002379',
          productKey: 'OpenHouse Choice Florida',
          recipients: [
            {
              address: {
                city: 'Jacksonville',
                countryCode: null,
                county: null,
                countyFIPS: null,
                line1: '13024 Pechora Ct',
                line2: null,
                postalCode: '32246',
                state: 'FL',
                stateCode: null
              },
              email: 'carlagomezcds+03@gmail.com',
              firstName: 'ctest',
              isDefaultRecipient: true,
              lastName: 'test',
              partyType: 'Consumer',
              phoneNumber: '(545) 564-5454'
            }
          ],
          referenceId: '00000000-0000-0000-0000-000000000005_OH-000002379C1',
          referenceNumber: 'OH-000002379C1',
          shippingEmail: 'carlagomezcds+03@gmail.com',
          shippingFirstName: 'ctest',
          shippingLastName: 'test',
          sk: 'ClaimDisbursement',
          state: 'Pending'
        })
      ];

      const response = await upload(tenantId, disbursements);

      // Validate Result
      expect(response, 'Upload to VPay response').to.eq('Success uploading data to VPay');
    });
  });
});
