import * as Joi from 'joi';
import { Disbursement } from '../../models/Disbursement';
import { ServiceEventProducer } from '../../../../../libs/ServiceEventProducer';

const { DetailType } = ServiceEventProducer;

const ReturnEventType = [
  DetailType.ClaimDisbursementStateChanged,
  DetailType.RequestDisbursementAction
];

export const changeActionSchema = Joi.object({
  disbursementId: Joi.string().allow('').allow(null).optional(),
  action: Joi.string().valid(...Object.values(Disbursement.Actions)).required(),
  disbursementType: Joi.string().allow('').allow(null).optional(),
  rejectReason: Joi.string().allow('').allow(null).optional(),
  paymentId: Joi.string().allow('').allow(null).optional(),
  returnEvent: Joi.string().valid(...ReturnEventType).optional()
});
