import * as Joi from 'joi';
import { addressSchema } from './AddressSchema';
import { disbursementTypeSchema } from './DisbursementTypeSchema';
import { paymentDetailSchema } from './PaymentDetailSchema';
import { recipientSchema } from './RecipientSchema';
import { DisbursementRepository } from '../../DisbursementRepository';
import { CostType, DeliveryMethodType, CatastropheType, Reasons } from '../../../../../libs/enumLib';
import { ServiceEventProducer } from '../../../../../libs/ServiceEventProducer';

const { DisbursementReferenceType } = DisbursementRepository;
const { DetailType } = ServiceEventProducer;

const ReturnEventType = [
  DetailType.DisbursementCreated,
  DetailType.ClaimDisbursementCreated
];

/**
 * Joi validation schema for a create disbursement payload
 */
export const createDisbursementSchema = Joi.object({
  amount: Joi.number().required(),
  approvalBy: Joi.string().allow('').allow(null).optional(),
  approvalDateTime: Joi.date().iso().allow('').allow(null).optional(),
  catastropheType: Joi.string().valid(...Object.values(CatastropheType)).optional(),
  costType: Joi.string().valid(...Object.values(CostType)).required(),
  coverage: Joi.string().allow('').allow(null).optional(),
  deliveryMethod: Joi.string().valid(...Object.values(DeliveryMethodType)).optional(),
  description: Joi.string().allow('').allow(null).optional(),
  disbursementType: disbursementTypeSchema,
  documentKeyList: Joi.array().items(Joi.string()).optional(),
  lossDateTime: Joi.date().allow('').allow(null).optional(),
  mailingAddress: addressSchema.required(),
  memberName: Joi.string().allow('').allow(null).optional(),
  memo: Joi.string().allow('').allow(null).optional(),
  paymentId: Joi.string().optional(),
  paymentType: Joi.string().allow('').allow(null).optional(),
  paymentDetailList: Joi.array().optional().items(paymentDetailSchema),
  policyId: Joi.string().optional(),
  policyNumber: Joi.string().optional(),
  productKey: Joi.string().required(),
  reason: Joi.string().valid(...Object.values(Reasons)).optional(),
  recipients: Joi.array().items(recipientSchema).required(),
  referenceId: Joi.string().required(),
  referenceNumber: Joi.string().required(),
  referenceType: Joi.string().valid(...Object.values(DisbursementReferenceType)).optional(),
  returnEvent: Joi.string().valid(...ReturnEventType).optional(),
  shippingCompanyName: Joi.string().allow('').allow(null).optional(),
  shippingEmail: Joi.string().allow('').allow(null).optional(),
  shippingFirstName: Joi.string().allow('').allow(null).optional(),
  shippingLastName: Joi.string().allow('').allow(null).optional()
});
