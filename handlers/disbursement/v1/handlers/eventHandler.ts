import { createDisbursements } from '../helpers/createDisbursements';
import { editDisbursement } from '../helpers/editDisbursement';
import { DisbursementPayload } from '../models';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import ExtendableError from '../../../../models/ExtendableError';
import { ErrorCodes } from '../../../../models/ErrorCodes';
import Tenant from '../../../../libs/Tenant';
import { requestDisbursementAction } from '../helpers/requestDisbursementAction';
import { updateDisbursementReconFiles } from '../helpers/updateDisbursementReconFiles';

/**
 * Main entry point for event response handler.
 * @param {object} event Event data.
 */
export const main = async (event) => {
  try {
    Tenant.initFromEvent(event.detail.key);

    const detailType = event['detail-type'];
    switch (detailType) {
      case ServiceEventProducer.DetailType.DisbursementCreate:
      case ServiceEventProducer.DetailType.PrintRequested:
        await createDisbursements(Tenant.tenantEntityId, new DisbursementPayload(event.detail.disbursementPayload));
        break;

      case ServiceEventProducer.DetailType.ClaimDisbursementRequestEdit:
        await editDisbursement(event?.detail?.disbursementPayload);
        break;

      case ServiceEventProducer.DetailType.RequestDisbursementAction:
        await requestDisbursementAction(Tenant.email, event.detail.disbursementActionPayload, true);
        break;

      case ServiceEventProducer.DetailType.TransferDocumentResponse:
        await updateDisbursementReconFiles(event?.detail);
        break;

      default:
        throw new ExtendableError(`Action ${detailType} not handled.`, ErrorCodes.EVENT_NOT_HANDLED);
    }
  } catch (err) {
    console.error(err);
  }
};
