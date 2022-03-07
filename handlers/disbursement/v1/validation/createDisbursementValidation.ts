import { createDisbursementSchema } from './schemas/CreateDisbursementSchema';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../libs/errors/ValidationSchemaError';

/**
 * Validates a create disbursement payload
 * @param payload Body with note string
 */
export const validateCreateDisbursement = (payload: any) => {
  const validator = createDisbursementSchema.validate(payload);

  if (validator?.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      validator.error.details,
      `Invalid create disbursement payload request value.`
    );
  }
};
