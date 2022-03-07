export class ValidationSchemaError extends Error {
  code: number;
  path: string;

  constructor(message: any, code: number, path: string) {
    super(message);
    this.code = code;
    this.path = path;
  }

  static buildError(code, details, defaultMessage) {
    const [detail] = details;
    const { message = defaultMessage, context } = detail || {};
    const { key } = context || {};

    return new ValidationSchemaError(message, code, key);
  }
}

module.exports = ValidationSchemaError;
