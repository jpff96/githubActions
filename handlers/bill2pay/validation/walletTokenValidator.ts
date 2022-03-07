import { ErrorCodes } from '../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../libs/errors/ValidationSchemaError';
import { walletTokenRequestSchema } from './schemas/walletTokenRequestSchema';

/**
 * Validates a walletToken object.
 * @param walletToken Wallet token object to validate
 */
export const validateSchema = (walletToken: any) => {
  const walletTokenValidation = walletTokenRequestSchema.validate(walletToken);
  if (walletTokenValidation && walletTokenValidation.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      walletTokenValidation.error.details,
      'Invalid Wallet Token object'
    );
  }
};
