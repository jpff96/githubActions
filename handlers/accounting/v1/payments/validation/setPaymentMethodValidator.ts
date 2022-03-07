import { setPaymentMethodSchema } from "./schemas/setPaymentMethodSchema";
import { ErrorCodes } from '../../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../../libs/errors/ValidationSchemaError';

export const validateSchema = (data) => {
  const setPaymentMethodValidation = setPaymentMethodSchema.validate(data, { allowUnknown: true });

  if (setPaymentMethodValidation?.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      setPaymentMethodValidation.error.details,
      'Invalid payment method request object'
    );
  }
};
