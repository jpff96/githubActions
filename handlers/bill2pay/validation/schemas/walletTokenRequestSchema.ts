import * as Joi from 'joi';

/**
 * Wallet Token request schema definition
 */
export const walletTokenRequestSchema = Joi.object({
    customerId: Joi.string().required(),
    redirectHref: Joi.string().required()
});
