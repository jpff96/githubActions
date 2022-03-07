import { logError } from '@eclipsetechnology/eclipse-api-helpers';
import axios from 'axios';
import { VPayDocument } from '../models/VPayDocument';

/**
* This API is used to fetch reconciliation files from VPay.
* @param transactionId
*/
export class VPayDocumentAPI {
  headers: any;
  baseUrl: string;

  constructor(src?: any) {
    if (src) {
      this.headers = {
        'X-Client-Id': src.clientId,
        'X-Client-Secret': src.clientSecret,
        'Content-Type': 'application/json'
      }
      this.baseUrl = src.href;
    }
  }
  /**
  * Returns the list of documents for the VPay Transaction ID.
  * @param transactionId
  */
  public getDocuments = async (transactionId: string, retries = 3): Promise<VPayDocument[]> => {
    return axios({
      method: 'get',
      url: `${this.baseUrl}/${transactionId}`,
      headers: this.headers
    }).then((response) => {
      const ret = [];
      for (const doc of response.data) {
        ret.push(new VPayDocument(doc));
      }
      return ret;
    }, async (err) => {
      logError(console.log, err, 'Unable to get documents for transactionId: ' + transactionId);
      if (retries > 0) {
        return await this.getDocuments(transactionId, retries - 1);
      }
      return [];
    });
  };

  /**
  * Returns the Document for the specified Transaction Id and Document Id.
  * @param transactionId
  * @param documentId
  */
  public downloadDocument = async (transactionId: string, documentId: string, retries = 3): Promise<any> => {
    return axios({
      method: 'get',
      url: `${this.baseUrl}/${transactionId}/${documentId}/download`,
      headers: this.headers
    }).then((response) => {
      return response.data;
    }, async (err) => {
      logError(console.log, err, 'Unable to download the document: ' + documentId);
      if (retries > 0) {
        return await this.getDocuments(transactionId, retries - 1);
      }
      return null;
    });
  };
}
