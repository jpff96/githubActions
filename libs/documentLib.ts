import * as DocumentLib from '@eclipsetechnology/document-library';
import { logError } from '@eclipsetechnology/eclipse-api-helpers';

DocumentLib.config({
  awsRegion: process.env.AWS_SERVICE_REGION,
  docTable: process.env.DOC_TABLE_NAME,
  docBucket: process.env.DOC_STORAGE_BUCKET
});

export const getDocument = async (key: string): Promise<any> => {
  let docBody = null;
  try {
    docBody = await DocumentLib.getDocument(key);
  } catch (err) {
    logError(console.error, err, `Error retrieving document (${key})`);
  }

  return docBody;
};
