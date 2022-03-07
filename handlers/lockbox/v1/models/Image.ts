/**
 * @class Image
 */
export class Image {
  side: Image.Sides = Image.Sides.Front;
  token: string = '';
  name: string = '';

  /**
   * Initializes a new instance of the @see Image class.
   * @param side Side value.
   * @param token S3 bucket token.
   * @param name The name assigned by the lockbox.
   */
  constructor(side: Image.Sides, token: string, name: string) {
    this.side = side;
    this.token = token;
    this.name = name;
  }
}

export namespace Image {
  /**
   * Side values.
   */
  export enum Sides {
    Front = 'Front',
    Back = 'Back'
  }
}
