require('dotenv').config();
import * as chai from 'chai';
import { Batch } from '../models';
import { VPayDocumentAPI } from '../../../vPay/v1/API/VPayDocumentAPI';
import * as fs from 'fs';
import { EntityAPI } from '../../../../libs/API/EntityAPI';
import { Configuration } from '../../../../libs/constLib';
import { logError } from '@eclipsetechnology/eclipse-api-helpers';

describe.skip('Test get vPay integration.', function () {
  it('Get documents by transaction', async () => {
    try {
      // test
      const entityId = '00000000-0000-0000-0000-000000000005';;
      const config = await EntityAPI.getApiConfig(entityId, Configuration.API_SIG);
      const creds = config?.settings?.vPayDocuments || {};
    
      const api = new VPayDocumentAPI(creds);

      console.log('Start test');
      const transactionid = '370159548';

      // Get all documents for a transaction
      const result = await api.getDocuments(transactionid);
      for (const doc of result) {
        // get document
        const fileData = await api.downloadDocument(transactionid, doc.documentId);
        // S3Util.upload(fileData, `test/${doc.fileName}_${doc.documentId}`, 'application/pdf');

        // write file to disk
        const TEST_LOCAL_PÀTH = "pah to your local machine";
        fs.writeFile(`${TEST_LOCAL_PÀTH}${doc.documentId}.pdf`, fileData, (err) => {
          if (err) {
            console.log(err);
          }
        });
      }
      // console.log(result);
    } catch (error) { 
      logError(console.log, error, 'Error ocurred');
    }
  });
});
