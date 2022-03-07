import * as Joi from 'joi';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../libs/errors/ValidationSchemaError';
import { DisbursementRepository } from '../DisbursementRepository';

const { BatchRecordType } = DisbursementRepository;

const batchValidation = Joi.string().valid(
  BatchRecordType.Batch,
  BatchRecordType.ClaimBatch,
  BatchRecordType.PrintBatch
);

/**
 * Validates a string for the batch type.
 * @param value Batch type string
 */
export const validateBatchType = (value: string) => {
  const batchTypeValidator = batchValidation.validate(value);

  // Validating that status is correctly sent
  if (batchTypeValidator?.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      batchTypeValidator.error.details,
      `Invalid batch type value.`
    );
  }
};
