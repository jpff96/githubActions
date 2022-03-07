/**
 * Class B2PDeleteMethodResult
 * @class B2PDeleteMethodResult
 */
export class B2PDeleteMethodResult {
  resultCode: number;
  resultMessage: string;

  /**
   * Initializes a new instance of the @see B2PDeleteMethodResult class.
   * @param src
   */
  constructor(src?: any) {
    if (src) {
      this.resultCode = src.resultCode;
      this.resultMessage = src.resultMessage;
    }
  }
}
