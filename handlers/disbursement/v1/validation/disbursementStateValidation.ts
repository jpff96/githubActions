import * as Joi from 'joi';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../libs/errors/ValidationSchemaError';
import { Disbursement } from '../models';

const stateFilterValidation = Joi.string().valid(...Object.values(Disbursement.States));

/**
 * Validates a string for the state filter.
 * @param value State filter string
 */
export const validateDisbursementStateFilter = (value: string) => {
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
