import * as express from 'express';
import { Request, Response } from 'express';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import * as bill2pay from './index';
import { APIGatewayProxyHandler } from 'aws-lambda';
import * as ServerlessHttp from 'serverless-http';

const app = express();

// create application/json parser
app.use(bodyParser.json());

//CORS
app.use(cors());

app.post('/generateTransactionToken', async (req: Request, res: Response) => await bill2pay.getTransactionToken(req,res));
app.post('/generateWalletToken', async (req: Request, res: Response) => await bill2pay.getWalletToken(req,res));
app.delete('/deletePaymentMethod', async (req: Request, res: Response) => await bill2pay.deletePaymentMethod(req,res));
app.get('/listPaymentMethods/:id', async (req: Request, res: Response) => await bill2pay.listPaymentMethods(req,res));
//TODO: migrate this endpoint
//app.post('/paymentWithMethodToken', async (req: Request, res: Response) => await bill2pay.payWithMethodToken(req,res));
app.get('/paymentStatus/:id', async (req: Request, res: Response) => await bill2pay.getPaymentStatus(req,res));


export const main: APIGatewayProxyHandler = ServerlessHttp(app, {
    basePath: '/payment/v1/bill2pay'
  }) as APIGatewayProxyHandler;
  