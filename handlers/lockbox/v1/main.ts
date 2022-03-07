import * as express from 'express';
import { Request, Response } from 'express';
import { APIGatewayProxyHandler } from 'aws-lambda';
import * as ServerlessHttp from 'serverless-http';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as batch from './batch/index';

const app = express();

// create application/json parser
app.use(bodyParser.json());

// CORS
app.use(cors());

// Version 1
// Batch
app.get('/v1/list', async (req: Request, res: Response) => await batch.getBatches(req, res));
app.post('/v1/:id/transaction/:transId/note', async (req: Request, res: Response) => await batch.addNote(req, res));
app.get(
  '/v1/:id/transaction/:transId/images',
  async (req: Request, res: Response) => await batch.getTransactionImages(req, res)
);
app.post(
  '/v1/:id/transaction/:transId/action',
  async (req: Request, res: Response) => await batch.requestAction(req, res)
);
app.get('/v1/:id/transaction/:transId', async (req: Request, res: Response) => await batch.getTransaction(req, res));
app.post('/v1/:id/release', async (req: Request, res: Response) => await batch.releaseBatch(req, res));
app.get('/v1/:id', async (req: Request, res: Response) => await batch.getBatch(req, res));

/**
 * Main entry point for the user detail.
 * @param event Event data.
 */
export const main: APIGatewayProxyHandler = ServerlessHttp(app, {
  basePath: '/lockbox'
}) as APIGatewayProxyHandler;
