import * as MediaLibrary from '@eclipsetechnology/media-library';
import { MediaFile } from '@eclipsetechnology/media-library/dist/models/MediaFile';
import { MediaInfo } from '@eclipsetechnology/media-library/dist/models/MediaInfo';
import { MediaPayload } from '@eclipsetechnology/media-library/dist/models/MediaPayload';

MediaLibrary.config({
  mediaTable: process.env.MEDIA_TABLE_NAME,
  mediaBucket: process.env.BUCKET,
  awsRegion: process.env.AWS_SERVICE_REGION
});

/**
 * @class MediaAPI
 */
export class MediaAPI {
  static source = 'Accounting';

  /**
   * Upload a base64 media
   * @param payload Media payload
   * @param entity  Entity id from event
   */
  static async uploadBase64Media(payload: MediaPayload, entity: string): Promise<MediaInfo> {
    return await MediaLibrary.uploadBase64Media(payload, entity, MediaAPI.source);
  }

  /**
   * Fetch media
   * @param token Media token id
   */
  static async fetchMedia(token: string): Promise<MediaFile> {
    return await MediaLibrary.fetchMedia(token);
  }
}
