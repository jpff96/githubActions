import * as mimeTypes from 'mime-types';

import { IDocumentCreateKeyInfo } from '@eclipsetechnology/document-library/dist/@types/IDocumentCreateKeyInfo';
import { DocumentType, SourceType, VisibilityType } from '@eclipsetechnology/document-library/dist/@types/enums';
import { logTrace } from '@eclipsetechnology/eclipse-api-helpers';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';

// import { ClaimMain } from '../../../handlers/v1/models';
import { IDocumentTransferKeyInfo } from '@eclipsetechnology/document-library/dist/@types';
import { ServiceEventProducer } from '../../../libs/ServiceEventProducer';
import { S3Util } from '../../S3Util';


/**
 * Document Event Producer
 */
export class DocumentEventCreator {
/**
* Create event detail for TransferDocument event bridge event
*
* @param entityId
* @param referenceKey
* @param s3bucket
* @param s3Path
* @param name
* @param source
* @param callbackEvent
* @param extraInfo
* @returns
*/

static createTransferEventDetail = (
  entityId: string,
  referenceKey: string,
  s3bucket: string,
  s3Path: string,
  name: string,
  source: SourceType,
  callbackEvent?: ServiceEventProducer.DetailType,
  extraInfo?: any
): any => {
  const loggerInfo = new LoggerInfo(console.log, true);
  const logSig = '🚀-DocumentEventCreator.createTransferEventDetail';
  logTrace(loggerInfo, logSig, 'info');

  const docTransferKeyInfo: IDocumentTransferKeyInfo = {
    documentType: DocumentType.Misc,
    entityId: entityId,
    referenceKey,
    visibilityType: VisibilityType.External,
    source: source,
    callbackEvent: callbackEvent,
    extraInfo
  };

  // Lookup the file type from the file
  let fileType = mimeTypes.lookup(name);
  if (fileType === false) {
    fileType = S3Util.fileTypes.PDF;
  }

  const detail = {
    key: docTransferKeyInfo,
    s3SrcBucket: s3bucket,
    s3SrcPath: s3Path,
    name: name,
    fileType: fileType
  };

  logTrace(loggerInfo, logSig, 'detail', detail);

  return detail;
};
}
