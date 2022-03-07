import * as Joi from 'joi';
import { disbursementTypeSchema } from './DisbursementTypeSchema';
import { recipientSchema } from './RecipientSchema';
import { ServiceEventProducer } from '../../../../../libs/ServiceEventProducer';

const { DetailType } = ServiceEventProducer;

// Ensure that it accepts only the return events we're going to process
const ReturnEventType = [
  DetailType.ClaimDisbursementEditResponse
];

/**
 * Joi validation schema for an edit disbursement payload
 */
export const editDisbursementSchema = Joi.object({
  batchId: Joi.string().required(),
  batchNumber: Joi.string().required(),
  disbursementId: Joi.string().required(),
  disbursementNumber: Joi.string().required(),
  disbursementType: disbursementTypeSchema,
  paymentId: Joi.string().optional(),
  policyId: Joi.string().optional(),
  recipients: Joi.array().items(recipientSchema).required(),
  referenceId: Joi.string().required(),
  referenceNumber: Joi.string().required(),
  returnEvent: Joi.string().valid(...ReturnEventType).optional()
});
