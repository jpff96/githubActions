import { changeActionSchema } from './schemas/ChangeActionSchema';
import { ErrorCodes, ValidationSchemaError } from '../../../../libs/errors';

/**
 * Validates an action for the transaction.
 * @param value Body with note string
 */
export const validateAction = (value: string) => {
  const actionValidator = changeActionSchema.validate(value);

  // Validating that status is correctly sent
  if (actionValidator?.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      actionValidator.error.details,
      `Invalid action request value.`
    );
  }
};
