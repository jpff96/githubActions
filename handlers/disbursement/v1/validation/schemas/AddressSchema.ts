import * as Joi from 'joi';

/**
 * Joi validation schema for an address object
 */
export const addressSchema = Joi.object({
  city: Joi.string().allow('').allow(null),
  countryCode: Joi.string().allow('').allow(null),
  county: Joi.string().allow('').allow(null),
  countyFIPS: Joi.string().allow('').allow(null),
  line1: Joi.string().allow('').allow(null),
  line2: Joi.string().allow('').allow(null),
  postalCode: Joi.string().allow('').allow(null),
  state: Joi.string().allow('').allow(null),
  stateCode: Joi.string().allow('').allow(null)
});
