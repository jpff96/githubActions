import { ImageResponse } from './ImageResponse';

/**
 * @class ImagesResponse
 */
export class ImagesResponse {
  images = new Array<ImageResponse>();

  /**
   * Initializes a new instance of the @see  ImagesResponse class.
   * @param src
   */
  constructor(src?: Array<ImageResponse>) {
    if (src) {
      this.images = src;
    }
  }
}
