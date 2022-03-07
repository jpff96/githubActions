import { disbursementTypeSchema } from './schemas/DisbursementTypeSchema';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../libs/errors/ValidationSchemaError';

/**
 * Validates a string for the disbursement type.
 * @param value Disbursement type string
 */
export const validateDisbursementType = (value: string) => {
  const typeValidator = disbursementTypeSchema.validate(value);

  // Validating that status is correctly sent
  if (typeValidator?.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      typeValidator.error.details,
      `Invalid disbursement type value.`
    );
  }
};
