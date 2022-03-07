import * as Joi from 'joi';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { ValidationSchemaError } from '../../../../libs/errors/ValidationSchemaError';

const noteValidationSchema = Joi.object({
  note: Joi.string()
});

/**
 * Validates a string for the note updates.
 * @param value Body with note string
 */
export const validateNote = (value: string) => {
  const noteValidator = noteValidationSchema.validate(value);

  // Validating that status is correctly sent
  if (noteValidator?.error) {
    throw new ValidationSchemaError(ErrorCodes.Validation, noteValidator.error.details, `Invalid note value.`);
  }
};
