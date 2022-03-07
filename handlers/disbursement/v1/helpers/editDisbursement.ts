import { DisbursementRepository } from '../DisbursementRepository';
import { Disbursement, DisbursementEventPayload, DisbursementState, EditDisbursementEventPayload } from '../models';
import { validateSchema } from '../validation/editDisbursementValidation';
import { client } from '../../../../libs/dynamodb';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';

const { States } = Disbursement;

/**
 * Edites a disbursement
 * @param input Data to create a disbursement
 */
export const editDisbursement = async (input: any): Promise<Disbursement> => {
  validateSchema(input);

  const data = new EditDisbursementEventPayload(input);

  const {
    disbursementId,
    disbursementType,
    paymentId,
    policyId,
    recipients,
    returnEvent
  } = data;

  const repository = new DisbursementRepository(client);
  const storedDisbursement = await repository.getDisbursement(disbursementId, disbursementType);

  let savedDisbursement;
  let isSuccess;
  let currentState = storedDisbursement.state.state;

  // Update state to approved if it was provider error
  if (currentState === States.ProviderError) {
    storedDisbursement.updateState(new DisbursementState({ state: Disbursement.States.Approved }));
    currentState = storedDisbursement.state.state;
  }

  // Edit and update disbursement only if wasn't uploaded to provider
  if (currentState === States.Pending || currentState === States.Approved) {
    const updateDisbursement = new Disbursement({ ...storedDisbursement, recipients });
    savedDisbursement = await repository.saveDisbursement(updateDisbursement, disbursementType);
    isSuccess = true;
  } else {
    savedDisbursement = storedDisbursement;
    isSuccess = false;
  }

  if (returnEvent) {
    const disbursementEventPayload = new DisbursementEventPayload(savedDisbursement);
    const detail = ServiceEventProducer.createDisbursementEditEventDetail(disbursementEventPayload, isSuccess, policyId, paymentId);

    await ServiceEventProducer.sendServiceEvent(detail, returnEvent);
  }

  return savedDisbursement;
};
