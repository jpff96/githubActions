import { installmentsCalculatorSchema } from "./schemas/installmentsCalculatorSchema";
import { ErrorCodes } from '../../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../../libs/errors/ValidationSchemaError';

export const validateSchema = (data) => {
  const installmentsCalculatorValidation = installmentsCalculatorSchema.validate(data, { allowUnknown: true });

  if (installmentsCalculatorValidation?.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      installmentsCalculatorValidation.error.details,
      'Invalid installments calculator request object'
    );
  }
};
