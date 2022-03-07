import * as Joi from 'joi';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../libs/errors/ValidationSchemaError';
import { LockboxRepository } from '../LockboxRepository';

const statusFilterValidation = Joi.string().valid(...Object.values(LockboxRepository.StatusFilters));

/**
 * Validates a string for the status filter.
 * @param value Status filter string
 */
export const validateStatusFilter = (value: string) => {
  const statusFilterValidator = statusFilterValidation.validate(value);

  // Validating that status is correctly sent
  if (statusFilterValidator?.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      statusFilterValidator.error.details,
      `Invalid status filter value.`
    );
  }
};
