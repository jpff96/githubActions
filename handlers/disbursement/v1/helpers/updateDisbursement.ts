import { DisbursementRepository } from '../DisbursementRepository';
import { Disbursement } from '../models';
import { client } from '../../../../libs/dynamodb';
import { VPayTransaction } from '../../../vPay/v1/models/VPayTransaction';
import { DisbursementState } from '../models/DisbursementState';
import { logError } from '../../../../libs/logLib';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { VPayDocumentAPI } from '../../../vPay/v1/API/VPayDocumentAPI';
import { S3Util } from '../../../../libs/S3Util';
import { EntityAPI } from '../../../../libs/API/EntityAPI';
import { Configuration } from '../../../../libs/constLib';
import { uploadFilesToDocumentSystem } from '../../../lockbox/v1/schedule/uploadFilesToDocumentSystem';
import { SourceType } from '@eclipsetechnology/document-library/dist/@types/enums';

/**
 * Updates a disbursement
 * @param transaction Parsed data from VPay outbound file to update a disbursement
 */
export const updateDisbursement = async (transaction: VPayTransaction, entityId): Promise<Disbursement> => {
  let disbursement: Disbursement = null;

  try {
    const repository = new DisbursementRepository(client);
    disbursement = await repository.getDisbursementById(transaction.disbursementId);

    if (disbursement) {
      const newState = new DisbursementState({
        state: transaction.status,
        updatedDateTime: transaction.transactionDateTime
      });
      disbursement.updateState(newState);

      if (transaction.status !== Disbursement.States.ProviderError) {
        disbursement.providerPaymentType = transaction.vPayPaymentType;
        disbursement.providerTransactionId = transaction.vPayTransactionId;
        disbursement.checkNumber = transaction.checkNumber;

        // Check for tracking number
        if (transaction.mailingTrackingNumber) {
          disbursement.mailingClass = transaction.mailingClass;
          disbursement.mailingTrackingNumber = transaction.mailingTrackingNumber;
        }

        if (transaction.status === Disbursement.States.Cleared) {
          // Get creds and create VPayDocumentAPI
          const config = await EntityAPI.getApiConfig(entityId, Configuration.API_SIG);
          const creds = config?.settings?.vPayDocuments;
          if (!creds) { 
            throw new Error('VPay reconciliation credentials not found.');
          }
          const api = new VPayDocumentAPI(creds);

          // Get documents for the transaction
          const documents = await api.getDocuments(transaction.vPayTransactionId);

          for (const document of documents) {
            // Download document
            const documentData = await api.downloadDocument(
              transaction.vPayTransactionId,
              document.documentId
            );
            if (documentData) { 
              // Upload to S3
              const s3Path = `${entityId}/transactions/${transaction.disbursementId}/${document.documentId}`;
              S3Util.upload(documentData, s3Path, 'application/pdf');
  
              // TODO: once the document-api is migrated, uncomment
              // // Transfer document to document-api
              // transferDocument(
              //   entityId,
              //   disbursement.referenceId,
              //   s3Path,
              //   document.fileName,
              //   SourceType.None,
              //   ServiceEventProducer.DetailType.TransferDocumentResponse,
              //   {
              //     disbursementId: disbursement.pk,
              //     disbursementType: disbursement.sk,
              //   }
              // );

            }
          }
        }
      } else {
        disbursement.rejectReason = transaction.rejectReason;

        let detailType;
        switch (disbursement.referenceType) {
          case DisbursementRepository.DisbursementReferenceType.Claim:
            detailType = ServiceEventProducer.DetailType.ClaimDisbursementProviderError;
            break;
          default:
            detailType = ServiceEventProducer.DetailType.PolicyDisbursementProviderError;
            break;
        }

        const detail = ServiceEventProducer.createDisbursementProviderErrorEventDetail(disbursement);
        await ServiceEventProducer.sendServiceEvent(detail, detailType);
      }

      await repository.saveDisbursement(disbursement);
    }

    return disbursement;
  } catch (ex) {
    logError(console.log, ex, 'Unable to update disbursement');
  }
};
