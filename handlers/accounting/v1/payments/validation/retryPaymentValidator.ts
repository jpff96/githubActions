import { retryPaymentSchema } from './schemas/retryPaymentSchema';
import { ErrorCodes } from '../../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../../libs/errors/ValidationSchemaError';

export const validateSchema = (data) => {
  const retryPaymentValidation = retryPaymentSchema.validate(data, { allowUnknown: true });

  if (retryPaymentValidation?.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      retryPaymentValidation.error.details,
      'Invalid retry payment request object'
    );
  }
};
