import * as Joi from 'joi';

/**
 * Transaction Token request schema definition
 */
export const transactionTokenRequestSchema = Joi.object({
  allowCreditCard: Joi.boolean().optional(),
  policyId: Joi.string().required(),
  policyNumber: Joi.string().optional(),
  provider: Joi.string().optional(),
  paymentPlan: Joi.string().optional(),
  redirectHref: Joi.string().required(),
  paymentSource: Joi.string().optional(),
  productName: Joi.string().optional(),
  customerId: Joi.string().required(),
  accountNumber: Joi.string().optional(),
  sdeType: Joi.string().optional(),
  effectiveDate: Joi.string(),
  expirationDate: Joi.string(),
  mainPremium: Joi.number().optional(),
  companionPremium: Joi.number().optional(),
  empa: Joi.number().optional(),
  companionPolicyFee: Joi.number().optional(),
  mainPolicyFee: Joi.number().optional(),
  dfsTax: Joi.number().optional(),
  companionId: Joi.string().required(),
  fslsoServiceFee: Joi.number().optional()
});
