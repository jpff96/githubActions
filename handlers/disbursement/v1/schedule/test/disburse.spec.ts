require('dotenv').config();
import * as chai from 'chai';
import * as sinon from 'sinon';
import { disburse } from '../disburse';

const { expect } = chai;
const sandbox = sinon.createSandbox();

describe('Disburse Tests', function () {
  this.timeout(20000);

  after(() => {
    sandbox.restore();
  });

  before(() => {});

  context('disburse', () => {
    it('call disburse', async () => {
      const event: any = {
        version: '0',
        id: '6e3b7688-ca19-2582-d279-c4facbc0dfd2',
        'detail-type': 'Scheduled Event',
        source: 'api.payment',
        account: '200159443319',
        region: 'us-west-2',
        time: '2020-05-29T00:48:42Z',
        resources: [],
        detail: {}
      };

      const response = await disburse(event, null, null);

      // Validate Result
      expect(response, 'disburse response').to.eq('OK');
    });
  });
});
