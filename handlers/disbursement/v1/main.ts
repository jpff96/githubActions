import * as express from 'express';
import { APIGatewayProxyHandler } from 'aws-lambda';
import * as ServerlessHttp from 'serverless-http';
import * as cors from 'cors';
import * as handler from './handlers/index';

const app = express();

// create application/json parser
app.use(express.json());

// CORS
app.use(cors());

// Batch
app.get('/v1/batch/list', handler.getBatches);
app.get('/v1/batch/:id', handler.getBatch);

// Outgoing documents
app.get('/v1/outgoingDocuments', handler.getOutgoingDocuments);

// Disbursement
app.post('/v1', handler.add);
app.get('/v1/:id', handler.getDisbursement);
app.post('/v1/:id/action', handler.requestDisbursementAction);

/**
 * Main entry point for the API gateway.
 * @param event Event data.
 */
export const main: APIGatewayProxyHandler = ServerlessHttp(app, {
  basePath: '/disbursement'
}) as APIGatewayProxyHandler;
