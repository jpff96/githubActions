import * as Joi from 'joi';

/**
 * Address Schema
 */
export const addressSchema = Joi.object({
  line1: Joi.string().required(),
  line2: Joi.string().optional().allow(null).allow(''),
  city: Joi.string().required(),
  state: Joi.string().required(),
  postalCode: Joi.string().required(),
  country: Joi.string().optional()
});
