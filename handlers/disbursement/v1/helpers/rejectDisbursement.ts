import { safeTrim } from '@eclipsetechnology/eclipse-api-helpers';
import { Disbursement, DisbursementEventPayload } from '../models';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { ErrorCodes, ValidationError } from '../../../../libs/errors';
import { DisbursementState } from '../models/DisbursementState';
import { ActivityLogProducer } from '../../../../libs/ActivityLogProducer';

const { States } = Disbursement;

interface IRejectDisbursementParams {
  paymentId: string;
  rejectReason: string;
  returnEvent: ServiceEventProducer.DetailType;
  isEvent: boolean;
}

/**
 * Rejects a disbursement
 * @param disbursement  Disbursement to reject
 * @param rejectReason  Reject reason
 * @param agencyEntityId Agency entity id of the policy
 */
export const rejectDisbursement = async (disbursement: Disbursement, agencyEntityId: string, params: IRejectDisbursementParams): Promise<void> => {
  const { policyId, state, disbursementNumber } = disbursement;

  const { paymentId, rejectReason, returnEvent, isEvent } = params;

  if (state.state === States.ProviderUploaded && isEvent === true) {
    // Send activity logs
    await ActivityLogProducer.sendActivityLog(
      policyId,
      agencyEntityId,
      `Reject action on disbursement {{disbursementNumber}} for policy {{policyId}} could not be completed. The disbursement has already been uploaded to the provider.`,
      {
        disbursementNumber,
        policyId
      }
    );
  } else {
    // If disbursement was already rejected or uploaded to provider and the function is called through http request, throw an exception
    if (state.state !== States.Pending && state.state !== States.Approved) {
      if (isEvent === false) {
        throw new ValidationError(ErrorCodes.Validation, `This disbursement is already rejected or uploaded to provider`);
      }
    }
    disbursement.updateState(new DisbursementState({ state: States.Rejected }));
    disbursement.rejectReason = safeTrim(rejectReason);
    // If the disbursement has not been uploaded to the provider, then send activity logs notifying the status change
    await ActivityLogProducer.sendActivityLog(
      policyId,
      agencyEntityId,
      `Disbursement {{disbursementNumber}} for policy {{policyId}} changed state from {{oldState}} to Rejected`,
      {
        disbursementNumber,
        policyId,
        oldState: state
      }
    );

    if (paymentId && returnEvent) {
      const disbursementEventPayload = new DisbursementEventPayload(disbursement);
      const detail = ServiceEventProducer.createChangeDisbursementStateEventDetail(disbursementEventPayload, policyId, paymentId);

      await ServiceEventProducer.sendServiceEvent(detail, returnEvent);
    }
  }


};
