import { VPayRecordType } from '../../../../libs/enumLib';

/**
 * Information used to represent transaction schedule trailer
 */
export class VPayTrailer {
  readonly recordType: string = VPayRecordType.Trailer;

  referenceRecordType: string;
  trailerRecordNumber: string;
  referenceRecordCount: string;

  /**
   * Initializes a new instance of the VPayTrailer class.
   * @param data Source to create new VPayTrailer record from.
   */
  constructor(data?: any) {
    this.loadFromSource(data);
  }

  /**
   * Load model from record or source snippet
   *
   * @param src
   */
  loadFromSource = (source?: any) => {
    if (source) {
      this.referenceRecordType = source.referenceRecordType;
      this.trailerRecordNumber = source.trailerRecordNumber;
      this.referenceRecordCount = source.referenceRecordCount;
    }
  };
}
