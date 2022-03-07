import {
  VPayRecordNumberType,
  VPayOriginType,
  VPayRecordType,
  VPayTpaType,
  VPayVersionType
} from '../../../../libs/enumLib';

/**
 * Information used to represent transaction schedule header
 */
export class VPayHeader {
  readonly recordType: string = VPayRecordType.Header;
  readonly origin: string = VPayOriginType.Semed;
  readonly tpa: string = VPayTpaType.Fim;
  readonly recordNumber: string = VPayRecordNumberType.RecordNumber;
  readonly version: string = VPayVersionType.Version;

  fileDateTime: string;

  /**
   * Initializes a new instance of the VPayHeader class.
   * @param data Source to create new VPayHeader record from.
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
      this.fileDateTime = source.fileDateTime;
    }
  };
}
