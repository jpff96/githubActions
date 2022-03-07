import { ErrorCodes } from './ErrorCodes';
import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';

export class ConfigurationError extends ErrorResult<ErrorCodes> {
  constructor(code: ErrorCodes, message: string) {
    super(code, message);
  }
}
