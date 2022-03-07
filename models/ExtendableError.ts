import { ErrorCodes } from "./ErrorCodes";

/**
 * Extendable Error
 */
export default class ExtendableError extends Error {
  errorCode: string;

  /**
   * Creates a new ExtendableError object.
   * @param {string} message Error message.
   * @param {ErrorCodes} errorCode Error code.
   */
  constructor(message, errorCode = ErrorCodes.NONE) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
  }
}
