import * as AWS from 'aws-sdk';
AWS.config.update({ region: process.env.AWS_SERVICE_REGION || 'us-west-2' });

let config = { convertEmptyValues: true } as unknown;

// if (process.env.IS_LOCAL) {
//   config = {
//     region: 'localhost',
//     endpoint: 'http://localhost:8000',
//     accessKeyId: 'DEFAULT_ACCESS_KEY', // needed if you don't have aws credentials at all in env
//     secretAccessKey: 'DEFAULT_SECRET', // needed if you don't have aws credentials at all in env
//     convertEmptyValues: true
//   };
// }

export const client = new AWS.DynamoDB.DocumentClient(config);
