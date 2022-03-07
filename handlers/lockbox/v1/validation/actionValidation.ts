import * as Joi from 'joi';
import { DeliveryMethodType } from '../../../../libs/enumLib';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../libs/errors/ValidationSchemaError';
import { CheckTransaction } from '../models/CheckTransaction';

const actionValidationSchema = Joi.object({
  action: Joi.string().valid(...Object.values(CheckTransaction.Action)),
  policyNumber: Joi.string().optional(),
  amount: Joi.number().optional(),
  recipients: Joi.array().optional(),
  deliveryMethod: Joi.string().valid(...Object.values(DeliveryMethodType)).optional(),
  reason: Joi.string().optional()
});

/**
 * Validates an action for the transaction.
 * @param value Body with note string
 */
export const validateAction = (value: string) => {
  const actionValidator = actionValidationSchema.validate(value);

  // Validating that status is correctly sent
  if (actionValidator?.error) {
    throw new ValidationSchemaError(
      ErrorCodes.Validation,
      actionValidator.error.details,
      `Invalid action request value.`
    );
  }
};
