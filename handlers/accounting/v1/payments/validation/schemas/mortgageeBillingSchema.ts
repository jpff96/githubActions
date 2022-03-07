import * as Joi from 'joi';
import { addressSchema } from './addressSchema';

/**
 * Mortgagee Billing Schema
 */
export const mortgageeBillingSchema = Joi.object({
  address: addressSchema,
  companyName: Joi.string().required(),
  loanNumber: Joi.string().required(),
  mortgageeType: Joi.string().optional(),
  phoneNumber: Joi.string().optional().allow(null).allow('')
});
