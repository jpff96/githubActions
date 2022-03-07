import { DeliveryMethodType } from '../../../../libs/enumLib';
import { Address } from '../../../../models/Address';
import { DisbursementRepository } from '../DisbursementRepository';
import { DisbursementHistory } from './DisbursementHistory';
import { DisbursementState } from './DisbursementState';

/**
 * @class OutgoingDocument
 */
export class OutgoingDocument {
  id: string = '';

  referenceNumber: string = '';
  referenceType: DisbursementRepository.DisbursementReferenceType =
    DisbursementRepository.DisbursementReferenceType.Unknown;
  referenceId: string;
  mailingAddress: Address = new Address();
  createdDateTime: string = '';
  status: DisbursementState = new DisbursementState();
  deliveryMethod: DeliveryMethodType = DeliveryMethodType.Standard;
  recipientFirstName: string = '';
  recipientLastName: string = '';
  documentHistory: DisbursementHistory[] = [];
  documentKey: string = '';
  trackingNumber: string = '';

  constructor(src?: any) {
    if (src) {
      this.id = src.id;

      this.referenceNumber = src.referenceNumber ?? '';
      this.referenceType = src.referenceType ?? DisbursementRepository.DisbursementReferenceType.Unknown;
      this.referenceId = src.referenceId ?? '';
      this.mailingAddress = src.mailingAddress;
      this.createdDateTime = src.createdDateTime ?? '';
      this.status = src.status;
      this.deliveryMethod = src.deliveryMethod ?? DeliveryMethodType.Standard;
      this.recipientFirstName = src.recipientFirstName ?? '';
      this.recipientLastName = src.recipientLastName ?? '';
      this.documentHistory = src.documentHistory;
      this.documentKey = src.documentKey;
      this.trackingNumber = src.trackingNumber;
    }
  }
}
