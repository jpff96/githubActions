
/**
 * VPay document.
 */
export class VPayDocument {
  transactionId: string; // This value is found in the Recon file as the SETXID or VPAYTRANSID.
  documentId: string;
  fileName: string;
  fileDetailType: VPayDocument.VPayDocumentTypeEnum;
  description: string;

  /**
  * Initializes a new instance of the VPayDocument class.
  * @param data Source to create new VPayDocument record from.
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
      this.transactionId = source.transactionId;
      this.documentId = source.documentId;
      this.fileName = source.fileName;
      this.fileDetailType = source.fileDetailType;
      this.description = source.description;
    }
  };
}

export namespace VPayDocument {
  /**
   * VPay Document Type.
   */
  export enum VPayDocumentTypeEnum {
    Undefined = 'Undefined', // Used by internal programs.
    ClearedCheck = 'ClearedCheck', // The image of the cleared check from the Meta bank with a copy of the reverse
    FaxDocument = 'FaxDocument', // Document faxed to the provider.
    Generic = 'Generic', // Used by internal programs.
    Hidden = 'Hidden', // Used by internal programs.
    Limited = 'Limited', // This is the most restrictive document with the credit card number masked.
    PDF = 'Pdf', // The file type which could include EOB and/or Vpayges.
    Text = 'Text' // The file generated during the re-issue process.
  }
}
