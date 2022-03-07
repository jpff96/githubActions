import { changeBillingMethodSchema } from "./schemas/changeBillingMethod";
import { ErrorCodes } from '../../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../../libs/errors/ValidationSchemaError';

export const validateSchema = (data) => {
  const changeBillingMethod = changeBillingMethodSchema.validate(data, { allowUnknown: true });

  if (changeBillingMethod && changeBillingMethod.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      changeBillingMethod.error.details,
      'Invalid balance due object'
    );
  }
};
