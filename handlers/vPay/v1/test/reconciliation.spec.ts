// import * as chai from 'chai';
// import * as sinon from 'sinon';
// import * as EntityLib from '@eclipsetechnology/entity-library';
// import { APIGatewayProxyEvent } from 'aws-lambda';
// import { reconciliation } from '../reconciliation';

// const { expect } = chai;
// const sandbox = sinon.createSandbox();
// const EntityIDType = {
//   SOLSTICE: '00000000-0000-0000-0000-000000000000',
//   OPENHOUSE: '00000000-0000-0000-0000-000000000005'
// };

// describe('vPay Reconcilliation Tests', function () {
//   require('dotenv').config();
//   EntityLib.config({
//     awsRegion: process.env.AWS_SERVICE_REGION,
//     entityTable: process.env.ENTITY_TABLE_NAME
//   });

//   this.timeout(20000);

//   after(function afterTest() {
//     sandbox.restore();
//   });

//   before(() => {
//     // sandbox.replace(ActivityLogProducer, 'sendActivityLog', () => {
//     //   // Do nothing just don't want activity logs sent during Unit test process.
//     // });
//   });

//   context('reconcilliation', function () {
//     it('call reconcilliation', async function () {
//       // Arrange
//       const event = ({
//         resource: '/payment/v1/vPay/{proxy+}',
//         path: `/payment/v1/vPay/reconciliation`,
//         httpMethod: 'GET',
//         pathParameters: null,
//         queryStringParameters: null,
//         requestContext: {
//           authorizer: {
//             tenantId: EntityIDType.OPENHOUSE,
//             email: 'test@test.com'
//           }
//         }
//       } as unknown) as APIGatewayProxyEvent;

//       // Act
//       const response: any = await reconciliation(event, null);

//       // Assert
//       console.log(response);

//       // Validate Result
//       expect(response.statusCode, 'Call Return Status Code').to.eq(201);
//     });
//   });
// });
