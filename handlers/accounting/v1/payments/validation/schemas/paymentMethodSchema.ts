import * as Joi from 'joi';

/**
 * Payment Method Schema
 */
export const paymentMethodSchema = Joi.object({
    nickName: Joi.string().required(),
    type: Joi.string().required(),
    expirationDate: Joi.optional(),
    token: Joi.string().required()
});
