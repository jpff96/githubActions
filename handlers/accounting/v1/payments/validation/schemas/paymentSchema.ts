import * as Joi from 'joi';
import { lineItemSchema } from './lineItemSchema';

/**
 * Payment schema definition
 */
export const paymentSchema = Joi.object({
  subtotal: Joi.number().required(),
  description: Joi.string().allow(''),
  policyNumber: Joi.string().optional(),
  companionNumber: Joi.string().allow(''),
  accountLast4: Joi.string().allow(null).optional(),
  batchId: Joi.string().optional(),
  checkNumber: Joi.number().allow(null).optional(),
  authCode: Joi.string().optional(),
  cognitoUserId: Joi.string().optional(),
  customerId: Joi.string().optional(),
  details: Joi.required(),
  images: Joi.array().optional(),
  loanNumber: Joi.string().optional(),
  paymentPlan: Joi.string().optional(),
  paymentType: Joi.string().required(),
  postMarkDate: Joi.string().allow('').allow(null).optional(),
  processedDateTime: Joi.string().optional(),
  productKey: Joi.string().optional(),
  provider: Joi.string().optional(),
  providerFee: Joi.number().optional(),
  providerReference: Joi.string().optional().allow(null),
  receivedDate: Joi.string().optional().allow(null),
  remainingBalance: Joi.number().optional(),
  confirmationNumber: Joi.string().optional().allow(null),
  status: Joi.string().optional(),
  subtotalPlusProviderFee: Joi.number().optional(),
  type: Joi.string().optional()
});
