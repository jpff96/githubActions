import { ErrorCodes } from './ErrorCodes';
import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';

export class ValidationSchemaError extends ErrorResult<ErrorCodes> {
  constructor(code: ErrorCodes, detail: Array<any>, message: string) {
    let description: string = '';
    if (detail) {
      const errors = detail.map((err) => err.message).join();
      description = `${message}: ${errors}`;
    } else {
      description = message;
    }

    super(code, description);
  }
}
