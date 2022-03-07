import * as Joi from 'joi';
import { balanceDueSchema } from './balanceDueSchema';
import { paymentPlanSchema } from './paymentPlanSchema';
import { mortgageeBillingSchema } from './mortgageeBillingSchema';

/**
 * BalanceDue request schema definition
 */
export const balanceDueRequestSchema = Joi.object({
  policyId: Joi.string().required(),
  agencyEntityId: Joi.string().required(),
  termEffectiveDate: Joi.string().required(),
  termExpirationDate: Joi.string().required(),
  productKey: Joi.string().required(),
  ownerEntityId: Joi.string().required(),
  customerId: Joi.string().required(),
  paymentPlan: paymentPlanSchema,
  mainBalanceDue: balanceDueSchema,
  companionBalanceDue: balanceDueSchema,
  mortgagee: mortgageeBillingSchema
});
