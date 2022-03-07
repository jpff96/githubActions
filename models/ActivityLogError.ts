import ExtendableError from "./ExtendableError";
import { ErrorCodes } from "./ErrorCodes";

/**
 * Activity Log Error
 */
export default class ActivityLogError extends ExtendableError {
  /**
   * Creates a new ActivityLogError object.
   * @param {string} message Error message.
   * @param {ErrorCodes} errorCode Error code.
   */
  constructor(message, errorCode = ErrorCodes.NONE) {
    super(message, errorCode);
  }
}
