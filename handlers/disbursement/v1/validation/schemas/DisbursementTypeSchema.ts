import * as Joi from 'joi';
import { DisbursementRepository } from '../../DisbursementRepository';

/**
 * Joi validation schema for a disbursement type
 */
export const disbursementTypeSchema = Joi.string().valid(
  DisbursementRepository.DisbursementRecordType.Disbursement,
  DisbursementRepository.DisbursementRecordType.ClaimDisbursement,
  DisbursementRepository.DisbursementRecordType.DisbursementPrint
).allow(null).allow('');
