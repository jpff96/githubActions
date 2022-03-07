import { Image } from './Image';

export class Document {
  documentType: string = '';
  images: Array<Image> = [];
  status: string = '';

  constructor() {}
}
