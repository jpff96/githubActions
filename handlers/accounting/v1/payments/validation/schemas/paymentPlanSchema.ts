import * as Joi from 'joi';
import { PaymentPlan } from '../../../models/PaymentPlan';

/**
 * Payment Plan Schema
 */
export const paymentPlanSchema = Joi.object({
  planType: Joi.string().valid(...Object.values(PaymentPlan.PaymentPlanType)).required(),
  responsibleParty: Joi.string().valid(...Object.values(PaymentPlan.ResponsibleParty)).required()
});