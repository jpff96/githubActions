import * as Joi from 'joi';
import { lineItemSchema } from './lineItemSchema';

/**
 * BalanceDue schema definition
 */
export const balanceDueSchema = Joi.object({
  subtotal: Joi.number().required(),
  balanceType: Joi.string().required(),
  dueDate: Joi.string().allow(''),
  description: Joi.string().allow(''),
  lineItems: Joi.array().items(lineItemSchema),
  policyNumber: Joi.string().required(),
  effectiveDate: Joi.string().required(),
  companionNumber: Joi.string().allow(''),
  version: Joi.string().required()
});
