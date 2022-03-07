import { ErrorCodes } from '../../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../../libs/errors/ValidationSchemaError';
import { actionSchema } from './schemas/actionSchema';

/**
 * Validates a balance action object.
 * @param actionDetail Action object to validate
 */
export const validateAction = (actionDetail: any) => {
  const actionValidation = actionSchema.validate(actionDetail);
  if (actionValidation && actionValidation.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      actionValidation.error.details,
      'Invalid balance action object'
    );
  }
};
