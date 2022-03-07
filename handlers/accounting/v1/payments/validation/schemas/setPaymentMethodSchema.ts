import * as Joi from 'joi';
import { paymentMethodSchema } from './paymentMethodSchema';

/**
 * Payment Method Schema
 */
export const setPaymentMethodSchema = Joi.object({
    policyId: Joi.string().required(),
    paymentMethod: paymentMethodSchema
});
