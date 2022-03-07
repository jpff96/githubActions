import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { OutgoingDocument } from './OutgoingDocument';

/**
 * Information used to represent a outgoing docuement response
 */
export class OutgoingDocumentResponse {
  outgoingDocuments: OutgoingDocument[];
  lastEvaluatedKey: DocumentClient.Key;

  /**
   * Initializes a new instance of the OutgoingDocumentResponse class.
   * @param src Source to create new OutgoingDocumentResponse record from.
   */
  constructor(src?: any) {
    this.loadFromSource(src);
  }

  /**
   * Load model from record or source snippet
   *
   * @param src
   */
  loadFromSource = (src?: any) => {
    if (src) {
      this.outgoingDocuments = src.outgoingDocuments;
      this.lastEvaluatedKey = src.lastEvaluatedKey;
    }
  };
}
