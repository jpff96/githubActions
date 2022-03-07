import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { DocumentEventCreator } from '../../../../libs/events/documents/DocumentEventCreator';
import { Image } from '../models/Image';
import { SourceType } from '@eclipsetechnology/document-library/dist/@types/enums';
import { MediaAPI } from '../../../../libs/API/MediaAPI';

const mediaBucket = process.env.BUCKET;

/**
 * Send upload document request to document system and mark files as complete
 *
 * @param tenantEntityId
 * @param entityId
 * @param policyId
 * @param referenceId
 * @param images
 */
export const uploadFilesToDocumentSystem = async (
  tenantEntityId: string,
  entityId: string,
  policyId: string,
  referenceId: string,
  images: Array<Image>
) => {
  try {
    for (const image of images) {
      const { token, name } = image;

      const { file, mediaInfo } = await MediaAPI.fetchMedia(token);

      const detail = DocumentEventCreator.createTransferEventDetail(
          entityId,
          policyId,
          mediaBucket,
          mediaInfo.key,
          name,
          SourceType.Lockbox
        );
        await ServiceEventProducer.sendServiceEvent(detail, ServiceEventProducer.DetailType.TransferDocument);
    }
  } catch (e) {
    console.error(e);
  }
};