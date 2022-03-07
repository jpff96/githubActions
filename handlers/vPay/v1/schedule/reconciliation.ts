import { ScheduledEvent, Handler } from 'aws-lambda';
import { logError } from '@eclipsetechnology/eclipse-api-helpers';
import { download as downloadFromVPay } from '../download';
import { archive as archiveOnVPay } from '../archive';
import { ProductAPI } from '../../../../libs/API/ProductAPI';
import { updateDisbursement } from '../../../disbursement/v1/helpers/updateDisbursement';
import { ServiceEventProducer } from '../../../../libs/ServiceEventProducer';
import { DisbursementRepository } from '../../../disbursement/v1/DisbursementRepository';

const { DisbursementRecordType } = DisbursementRepository;

/**
 * Main entry point for the reconciliation CRON job.
 * @param event Event data.
 */
export const reconciliation: Handler = async (event: ScheduledEvent) => {
  try {
    // Get all the products and iterate them to get all the VPay outbound files
    const products = await ProductAPI.getProductList();

    for (const productKey of products) {
      const [productMain] = await ProductAPI.getConfiguration(productKey);
      const entityId = productMain?.consumerInfo?.agencyKey;

      // Download file
      const transactionsPackage = await downloadFromVPay(entityId);

      for (const transactionPackage of transactionsPackage) {
        const { transactions, fileName } = transactionPackage;

        for (const transaction of transactions) {
          const disbursement = await updateDisbursement(transaction, entityId);

          if (disbursement) {
            const eventDetail = ServiceEventProducer.createDisbursementUpdatedEventDetail(disbursement);
            let detailType;

            if (disbursement.sk === DisbursementRecordType.Disbursement) {
              detailType = ServiceEventProducer.DetailType.DisbursementUpdated;
            } else if (disbursement.sk === DisbursementRecordType.ClaimDisbursement) {
              detailType = ServiceEventProducer.DetailType.ClaimDisbursementUpdated;
            }

            await ServiceEventProducer.sendServiceEvent(eventDetail, detailType);
          }
        }

        // Archive file after being processed successfully
        await archiveOnVPay(fileName, entityId);
      }
    }

    return 'OK';
  } catch (ex) {
    logError(console.log, ex, 'reconciliation_ERROR');

    throw ex;
  }
};
