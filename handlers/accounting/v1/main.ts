import * as express from 'express';
import { APIGatewayProxyHandler } from 'aws-lambda';
import * as ServerlessHttp from 'serverless-http';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as payments from './payments/index';

const app = express();

// create application/json parser
app.use(bodyParser.json());

// CORS
app.use(cors());

// Version 1
// Accounting
app.get('/v1/list/:entity', payments.list);
app.get('/unauth/v1/list/:entity', payments.list);
app.get('/v1/search', payments.search);
app.get('/v1/:id?', payments.get);
app.post('/v1/processPayment', payments.processPayment);
app.post('/v1/generateReinstatementToken', payments.generateReinstatementToken);
app.get('/v1/billing/:id?', payments.getBillingInformation);
app.post('/v1/setDefaultPaymentMethod', payments.setDefaultPaymentMethod);
app.get('/v1/getDefaultPaymentMethod/:id', payments.getDefaultPaymentMethod);
app.post('/v1/installments', payments.installmentsCalculator);
app.post('/v1/balanceDue', payments.createBalanceDue);
app.post('/v1', payments.createPayment);
app.post('/v1/:id/action', payments.requestAction);
app.post('/v1/retryPayment', payments.retryPayment);
app.post('/v1/changeBillingMethod', payments.changeBillingMethod);

/**
 * Main entry point for the user detail.
 * @param event Event data.
 */
export const main: APIGatewayProxyHandler = ServerlessHttp(app, {
  basePath: '/accounting'
}) as APIGatewayProxyHandler;
