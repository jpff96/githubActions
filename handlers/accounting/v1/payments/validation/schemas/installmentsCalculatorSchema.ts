import * as Joi from 'joi';

/**
 * Payment Method Schema
 */
export const installmentsCalculatorSchema = Joi.object({
  mainPremium: Joi.number().required(),
  companionPremium: Joi.number().required(),
  totalFees: Joi.number().required(),
  totalTaxes: Joi.number().required(),
  effectiveDate: Joi.string().required()
});
