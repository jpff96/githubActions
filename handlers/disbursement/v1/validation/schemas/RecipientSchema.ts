import * as Joi from 'joi';
import { addressSchema } from './AddressSchema';
import { RecipientPartyType, TaxIdType } from '../../../../../libs/enumLib';

/**
 * Joi validation schema for a recipient object
 */
export const recipientSchema = Joi.object({
  address: addressSchema.required(),
  companyName: Joi.string().allow('').allow(null).optional(),
  email: Joi.string().allow('').allow(null).optional(),
  firstName: Joi.string().allow('').allow(null).optional(),
  governmentIdNumber: Joi.string().allow('').allow(null).optional(),
  governmentIdType: Joi.string().valid(...Object.values(TaxIdType)).optional(),
  lastName: Joi.string().allow('').allow(null).optional(),
  isDefaultRecipient: Joi.boolean().required(),
  partyType: Joi.string().valid(...Object.values(RecipientPartyType)).required(),
  phoneNumber: Joi.string().allow('').allow(null).optional()
});
