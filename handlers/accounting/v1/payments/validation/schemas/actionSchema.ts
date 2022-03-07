import * as Joi from 'joi';
import { BalanceTransaction } from '../../../models/BalanceTransaction';
import { lineItemSchema } from './lineItemSchema';
import { paymentSchema } from './paymentSchema';

/**
 * Action schema definition
 */
export const actionSchema = Joi.object({
  action: Joi.string()
    .valid(...Object.values(BalanceTransaction.Action))
    .required(),
  description: Joi.string().allow('').optional(),
  reason: Joi.string().allow('').required(),
  entityId: Joi.string().required(),
  isNsf: Joi.boolean().optional(),
  lineItem: lineItemSchema.optional(),
  nsfAmount: Joi.number().optional(),
  payment: paymentSchema.optional(),
  policyNumber: Joi.string().required(),
  processedDateTime: Joi.string().allow('').allow(null).optional(),
  termEffectiveDate: Joi.string().isoDate().required(),
  transferPolicyId: Joi.string().optional(),
  transferPolicyNumber: Joi.string().optional(),
  version: Joi.string().required()
});
