import { ErrorCodes } from '../../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../../libs/errors/ValidationSchemaError';
import { createPaymentSchema } from './schemas/createPaymentSchema';

/**
 * Validates a payment object.
 * @param paymentDetail Payment object to validate
 */
export const validateSchema = (paymentDetail: any) => {
  const paymentValidation = createPaymentSchema.validate(paymentDetail);
  if (paymentValidation && paymentValidation.error) {
    throw new ValidationSchemaError(ErrorCodes.Validation, paymentValidation.error.details, 'Invalid payment object');
  }
};
