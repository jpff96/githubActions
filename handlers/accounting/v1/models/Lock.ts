/**
 * Lock
 * @class Lock
 */
export class Lock {
  pk: string;
  sk: string;
  timestamp: number;

  /**
   * Initializes a new instance of the @see {Lock} class.
   * @param src The source record.
   */
  constructor(src?: any) {
    if (src) {
      this.pk = src.pk;
      this.sk = src.sk;
      this.timestamp = src.timestamp;
    }
  }
}
