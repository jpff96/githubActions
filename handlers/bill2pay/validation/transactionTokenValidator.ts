import { ErrorCodes } from '../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../libs/errors/ValidationSchemaError';
import { transactionTokenRequestSchema } from './schemas/transactionTokenRequestSchema';

/**
 * Validates a TransactionToken object.
 * @param transactionToken Transaction token object to validate
 */
export const validateSchema = (transactionToken: any) => {
  const transactionTokenValidation = transactionTokenRequestSchema.validate(transactionToken);
  if (transactionTokenValidation && transactionTokenValidation.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      transactionTokenValidation.error.details,
      'Invalid Transaction Token object'
    );
  }
};
