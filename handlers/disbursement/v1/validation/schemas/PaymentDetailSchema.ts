import * as Joi from 'joi';
import { PaymentDetailType } from '../../../../../libs/enumLib';

export const paymentDetailSchema = Joi.object({
  coverageType: Joi.string().optional(),
  amount: Joi.number().required(),
  type: Joi.string().valid(...Object.values(PaymentDetailType)).required()
});
