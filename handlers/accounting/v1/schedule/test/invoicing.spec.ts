import * as chai from 'chai';
// import { APIGatewayProxyEvent } from 'aws-lambda';
// import * as sinon from 'sinon';
// import { main } from '../../main';
// import { AccountTransaction } from '../../models/AccountTransaction';

/**
 * Tests for user detail profiles
 */
describe('Test account payments', function () {
  const expect = chai.expect;

  context('payments', function () {
    //   const userProfile = {
    //     entityId: '00000000-0000-0000-0000-000000000000',
    //     userKey: 'test@user.com',
    //     infoTypeKey: 'MAIN_00000000-0000-0000-0000-000000000000',
    //     infoTypeUserKey: 'MAIN_test@user.com_',
    //     firstName: 'Test',
    //     lastName: 'User',
    //     phoneHome: '(406) 555-1212',
    //     phoneWork: '(406) 555-1313',
    //     allowEDocDelivery: true,
    //     mailingAddress: {
    //       line1: '1 Main Street',
    //       line2: '',
    //       city: 'Tampa',
    //       state: 'FL',
    //       postalCode: '12345'
    //     },
    //     isActive: true
    //   } as AccountTransaction;
    //   const createProfile = {
    //     entityId: '00000000-0000-0000-0000-000000000000',
    //     userKey: 'test@user.com',
    //     firstName: 'Test',
    //     lastName: 'User',
    //     phoneHome: '(406) 555-1212',
    //     phoneWork: '(406) 555-1313',
    //     allowEDocDelivery: true,
    //     mailingAddress: {
    //       line1: '1 Main Street',
    //       line2: '',
    //       city: 'Tampa',
    //       state: 'FL',
    //       postalCode: '12345'
    //     }
    //   } as IUserProfile;
    //   const event: APIGatewayProxyEvent = ({
    //     httpMethod: 'POST',
    //     headers: {
    //       origin: 'http://localhost:3000',
    //       'content-type': 'application/json'
    //     },
    //     path: '/userdetail/v2',
    //     body: createProfile,
    //     queryStringParameters: {
    //       isActive: 'true'
    //     },
    //     requestContext: {
    //       identity: {
    //         cognitoAuthenticationProvider: 'XYZ:cognitoIdentityId-USER-1234'
    //       },
    //       authorizer: {
    //         tenantId: '00000000-0000-0000-0000-000000000000',
    //         principalId: 'cognitoIdentityId-USER-1234',
    //         email: 'test@user.com',
    //         isConsumer: 'false'
    //       }
    //     }
    //   } as unknown) as APIGatewayProxyEvent;
    //   // Add
    //   sinon.replace(
    //     ProfileRepository.prototype,
    //     'create',
    //     (userProfile: IUserProfile): Promise<IUserProfile> => {
    //       userProfile.infoTypeKey = `${UserInfoType.MAIN}_${userProfile.entityId}`;
    //       userProfile.infoTypeUserKey = `${UserInfoType.MAIN}_${userProfile.userKey}`;
    //       userProfile.isActive = true;
    //       return Promise.resolve(userProfile);
    //     }
    //   );
    //   // Get
    //   sinon.replace(
    //     ProfileRepository.prototype,
    //     'get',
    //     (userKey: string, userInfoType: UserInfoType, entityId: string): Promise<IUserProfile> => {
    //       return Promise.resolve(userProfile);
    //     }
    //   );
    //   // Update
    //   sinon.replace(
    //     ProfileRepository.prototype,
    //     'update',
    //     (userProfile: IUserProfile): Promise<IUserProfile> => {
    //       return Promise.resolve(userProfile);
    //     }
    //   );
    //   // List
    //   sinon.replace(
    //     ProfileRepository.prototype,
    //     'list',
    //     (userInfoType: UserInfoType, entityId: string, isActive: boolean): Promise<Array<IUserProfile>> => {
    //       return Promise.resolve([userProfile]);
    //     }
    //   );
    //   /**
    //    * Create
    //    */
    //   it('should create a new user profile', async function () {
    //     // Arrange
    //     // Act
    //     const response: any = await main(event, null, null);
    //     const resBody = JSON.parse(response.body);
    //     // Assert
    //     expect(response.statusCode, 'Call Return Status Code').to.eq(201);
    //     expect(resBody.infoTypeKey, 'infoTypeKey').to.not.eq(null);
    //     expect(resBody.infoTypeUserKey, 'infoTypeUserKey').to.not.eq(null);
    //   });
    //   /**
    //    * Get
    //    */
    //   it('should get the user profile', async function () {
    //     // Arrange
    //     const getEvent = { ...event };
    //     getEvent.httpMethod = 'GET';
    //     getEvent.path = '/userdetail/v2/test%40user.com/entity/00000000-0000-0000-0000-000000000000';
    //     delete getEvent.body;
    //     // Act
    //     const response: any = await main(getEvent, null, null);
    //     const resBody = JSON.parse(response.body) as IUserProfile;
    //     // Assert
    //     expect(response.statusCode, 'Call Return Status Code').to.eq(200);
    //     expect(resBody.allowEDocDelivery, 'allowEDocDelivery').to.eq(userProfile.allowEDocDelivery);
    //     expect(resBody.entityId, 'entityId').to.eq(userProfile.entityId);
    //     expect(resBody.firstName, 'firstName').to.eq(userProfile.firstName);
    //     expect(resBody.lastName, 'lastName').to.eq(userProfile.lastName);
    //     expect(resBody.phoneHome, 'phoneHome').to.eq(userProfile.phoneHome);
    //     expect(resBody.phoneWork, 'phoneWork').to.eq(userProfile.phoneWork);
    //     expect(resBody.userKey, 'userKey').to.eq(userProfile.userKey);
    //   });
    //   /**
    //    * Update
    //    */
    //   it('should update a user profile', async function () {
    //     // Arrange
    //     const putEvent = { ...event };
    //     putEvent.httpMethod = 'PUT';
    //     putEvent.path = '/userdetail/v2';
    //     userProfile.firstName = 'NewFirstName';
    //     putEvent.body = JSON.stringify(userProfile);
    //     // Act
    //     const response: any = await main(putEvent, null, null);
    //     const resBody = JSON.parse(response.body) as IUserProfile;
    //     // Assert
    //     expect(response.statusCode, 'Call Return Status Code').to.eq(200);
    //     expect(resBody.firstName, 'firstName').to.eq('NewFirstName');
    //   });
    //   /**
    //    * List
    //    */
    //   it('should get a list of users for tenant', async function () {
    //     // Arrange
    //     const listEvent = { ...event };
    //     listEvent.httpMethod = 'GET';
    //     listEvent.path = '/userdetail/v2/list/00000000-0000-0000-0000-000000000000';
    //     delete listEvent.body;
    //     // Act
    //     const response: any = await main(listEvent, null, null);
    //     const resBody = JSON.parse(response.body) as IUserProfile;
    //     // Assert
    //     expect(response.statusCode, 'Call Return Status Code').to.eq(200);
    //     expect(resBody, 'length').to.length(1);
    //   });
  });
});
