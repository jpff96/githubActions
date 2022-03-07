/**
 * @class ImageResponse
 */
export class ImageResponse {
  name: string = '';
  path: string = '';
  preview: string = '';

  /**
   * Initializes a new instance of the @see  ImageResponse class.
   * @param name
   * @param path
   * @param preview
   */
  constructor(name: string, path: string, preview: string) {
    this.name = name;
    this.path = path;
    this.preview = preview;
  }
}
