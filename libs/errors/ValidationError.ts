import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { ErrorCodes } from './ErrorCodes';

export class ValidationError extends ErrorResult<ErrorCodes> {
  constructor(code: ErrorCodes, message: string) {
    super(code, message);
  }
}
