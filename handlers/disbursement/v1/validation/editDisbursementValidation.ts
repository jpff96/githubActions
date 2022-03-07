import { editDisbursementSchema } from './schemas/EditDisbursementSchema';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../libs/errors/ValidationSchemaError';

/**
 * Validates an edit disbursement payload
 * @param payload Input data to be validated
 */
export const validateSchema = (payload: any) => {
  const validator = editDisbursementSchema.validate(payload);

  if (validator?.error) {
    throw new ValidationSchemaError(ErrorCodes.Validation, validator.error.details, 'Invalid edit disbursement payload data');
  }
};
