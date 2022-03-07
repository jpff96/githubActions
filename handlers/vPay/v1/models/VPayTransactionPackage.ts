import { VPayTransaction } from './VPayTransaction';

/**
 * Information used to represent outbound transaction package
 */
export class VPayTransactionPackage {
  transactions: Array<VPayTransaction>;
  fileName: string;

  /**
   * Initializes a new instance of the VPayTransactionPackage class.
   * @param data Source to create new VPayTransactionPackage record.
   */
  constructor(data?: any) {
    this.loadFromSource(data);
  }

  /**
   * Load model from record or source snippet
   * @param src
   */
  loadFromSource = (source?: any) => {
    if (source) {
      this.transactions = source.transactions;
      this.fileName = source.fileName;
    }
  };
}
