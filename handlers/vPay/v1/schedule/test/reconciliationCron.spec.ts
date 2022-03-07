require('dotenv').config();
import * as chai from 'chai';
import * as sinon from 'sinon';
import { reconciliation } from '../reconciliation';

const { expect } = chai;
const sandbox = sinon.createSandbox();

describe('Reconciliation Test', function () {
  this.timeout(30000);

  after(() => {
    sandbox.restore();
  });

  before(() => {});

  context('reconciliation', () => {
    it('call reconciliation', async () => {
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

      const response = await reconciliation(event, null, null);

      // Validate Result
      expect(response, 'reconciliation response').to.eq('OK');
    });
  });
});
