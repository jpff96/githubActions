import * as Joi from 'joi';

/**
 * Payment schema definition
 */
export const createPaymentSchema = Joi.object({
  paymentInformation: Joi.object(),
  version: Joi.string(),
  policyId: Joi.string().required(),
  providerReference: Joi.string(),
  cognitoUserId: Joi.string().email(),
  customerId: Joi.string().required(),
  dueDate: Joi.string()
});
