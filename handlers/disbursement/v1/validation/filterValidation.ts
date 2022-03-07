import * as Joi from 'joi';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../libs/errors/ValidationSchemaError';
import { DisbursementRepository } from '../DisbursementRepository';

const stateFilterValidation = Joi.string().valid(...Object.values(DisbursementRepository.BatchStateFilters));

/**
 * Validates a string for the state filter.
 * @param value Status filter string
 */
export const validateStateFilter = (value: string) => {
  const stateFilterValidator = stateFilterValidation.validate(value);

  // Validating that state is correctly sent
  if (stateFilterValidator?.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      stateFilterValidator.error.details,
      `Invalid state filter value.`
    );
  }
};
