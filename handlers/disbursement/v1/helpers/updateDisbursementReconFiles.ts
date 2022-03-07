import { DisbursementRepository } from '../DisbursementRepository';
import { client } from '../../../../libs/dynamodb';

/**
 * Updates disbursement reconciliaton files list
 * @param event Event detail
 */
export const updateDisbursementReconFiles = async (detail: any) => {
  const repository = new DisbursementRepository(client);
  const { extraInfo: { disbursementId, disbursementType }, document: documentKey } = detail;

  // Get current disbursement
  const storedDisbursement = await repository.getDisbursement(disbursementId, disbursementType);

  // Add document key to disbursement
  storedDisbursement.addDocumentReconKey(documentKey);

  // Save disbursement
  await repository.saveDisbursement(storedDisbursement, disbursementType);
};
