import * as Joi from 'joi';
import { LineItem } from '../../../models/LineItem';

/**
 * Line item schema definition
 */
export const lineItemSchema = Joi.object({
  amount: Joi.number().required(),
  itemType: Joi.string()
    .valid(...Object.values(LineItem.ItemType))
    .required(),
  account: Joi.string()
    .valid(...Object.values(LineItem.AccountType))
    .required(),
  writingCompany: Joi.string().required()
});
