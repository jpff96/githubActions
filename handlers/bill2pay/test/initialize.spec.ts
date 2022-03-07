import * as chai from 'chai';
import * as sinon from 'sinon';
import * as asyncInitialize from '../generateTransactionToken';
import { EntityAPI } from '../../../libs/API/EntityAPI';
import { ActivityLogProducer } from '../../../libs/ActivityLogProducer';
import { PaymentProviderType } from '../../../libs/constLib';

const { expect } = chai;
const sandbox = sinon.createSandbox();

describe('Test payment initialize', function() {
  require('dotenv').config();

  this.timeout(20000);

  after(function afterTest() {
    sandbox.restore();
  });

  before(() => {
    sandbox.replace(ActivityLogProducer, 'sendActivityLog', () => {
      // Do nothing just don't want activity logs sent during Unit test process.
    });

    sandbox.replace(EntityAPI, 'getApiConfig', () => {
      return {
        confit: {
          bill2PayApiKey: 'MOCK_B2P_KEY'
        }
      };
    });
  });


  context('initialize', function() {
    it('call initialize - MOCK', async function() {
      // Arrange
      const event = require('../mocks/initialize-event.json');

      // Act
      const initResponse = await asyncInitialize.main(event,'');

      const resBody = JSON.parse(initResponse['body']);
      const { message } = resBody;

      // Assert

      // Validate Result
      expect(initResponse['statusCode'], 'Call Return Status Code').to.eq(200);

      // Validate Data
      expect(message.provider, 'provider').to.eq(PaymentProviderType.MOCK);
      expect(message.resultCode, 'resultCode').to.eq(200);
      expect(message.resultMessage, 'resultMessage').to.eq('success');

      const { response } = message;

      expect(response.acceptCreditCards, 'acceptCreditCards').to.eq(true);
      expect(response.acceptEChecks, 'acceptEChecks').to.eq(true);
      expect(response.creditCardFee, 'creditCardFee').to.eq(1.05);
      expect(response.eCheckFee, 'eCheckFee').to.eq(0.43);
      expect(response.providerResultCode, 'providerResultCode').to.eq(0);
      expect(response.transactionToken, 'acceptCreditCards').to.eq('MOCK_TOKEN_ID');
    });
  });
});
