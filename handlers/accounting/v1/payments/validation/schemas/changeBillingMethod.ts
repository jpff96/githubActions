import * as Joi from 'joi';
import { PaymentPlan } from '../../../models/PaymentPlan';

/**
 * BalanceDue request schema definition
 */
export const changeBillingMethodSchema = Joi.object({
  policyId: Joi.string().required(),
  responsibleParty: Joi.string()
    .valid(...Object.values(PaymentPlan.ResponsibleParty))
    .required(),
    paymentPlan: Joi.string()
    .valid(...Object.values(PaymentPlan.PaymentPlanType))
    .required()
});
