import { ErrorCodes } from '../../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../../libs/errors/ValidationSchemaError';
import { balanceDueRequestSchema } from './schemas/balanceDueRequestSchema';

/**
 * Validates a BalanceDue object.
 * @param balanceDue Balance due object to validate
 */
export const validateSchema = (balanceDue: any) => {
  const balanceDueValidation = balanceDueRequestSchema.validate(balanceDue);
  if (balanceDueValidation && balanceDueValidation.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      balanceDueValidation.error.details,
      'Invalid balance due object'
    );
  }
};
