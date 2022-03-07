import * as Joi from 'joi';

/**
 * Retry Payment Schema
 */
export const retryPaymentSchema = Joi.object({
  policyId: Joi.string().required(),
  paymentMethodToken: Joi.string().required()
});
