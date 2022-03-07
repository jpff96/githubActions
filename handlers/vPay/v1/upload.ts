import * as AWS from 'aws-sdk';
import * as AdmZip from 'adm-zip';
import * as Client from 'ssh2-sftp-client';
import { ProductAccounting } from '@eclipsetechnology/product-library/dist/models';

import { VPayFormatter } from './VPayFormatter';
import { Disbursement } from '../../disbursement/v1/models';

import { EntityAPI } from '../../../libs/API/EntityAPI';
import { ProductAPI } from '../../../libs/API/ProductAPI';
import { BufferEncodingTypes, VPayTpaType } from '../../../libs/enumLib';
import { Configuration } from '../../../libs/constLib';
import { logError } from '../../../libs/logLib';
import * as DocumentLib from '../../../libs/documentLib';

/**
 * Upload a payment package to vPay
 *
 * @param event Event data
 */
export const upload = async (tenantId: string, disbursements: Array<Disbursement>) => {
  try {
    // Load incoming data from event
    const config = await EntityAPI.getApiConfig(tenantId, Configuration.API_SIG);
    const { host, pwd, uid } = config?.settings?.vPay || {};

    const releaseDateObject = new Date(); // This will be called daily
    const parsedDate = VPayFormatter.parseDate(releaseDateObject);
    const packageName = `${VPayTpaType.Fim}_${parsedDate}`;

    let paymentFilePath: string;

    // Build the payment file
    try {
      paymentFilePath = await createPaymentPackage(
        disbursements,
        releaseDateObject,
        packageName
      );
    } catch (ex) {
      logError(console.error, ex, 'createPaymentPackage_ERROR');
      throw ex;
    }

    // Upload the payment file
    if (paymentFilePath) {
      const sftp = new Client();

      try {
        const sftpCommonOpts = {
          host: host,
          username: uid,
          password: pwd,
          port: 22,
          forceIPv4: false,
          forceIPv6: false,
          agent: process.env.SSH_AGENT,
          readyTimeout: 20000,
          strictVendor: true,
          retries: 2,
          retry_factor: 2,
          retry_minTimeout: 2000
        };

        await sftp.connect(sftpCommonOpts);
        await sftp.put(paymentFilePath, `./inbound/${packageName}.zip`);

        return 'Success uploading data to VPay';
      } catch (ex) {
        logError(console.error, ex, 'uploadSFTP_ERROR');
      } finally {
        if (sftp) {
          await sftp.end();
        }
      }
    }
  } catch (ex) {
    logError(console.error, ex, 'upload_ERROR');

    throw ex;
  }
};

/**
 * Create the payment package as a .zip file
 *
 * @param disbursements
 * @param releaseDate
 * @param packageName
 */
const createPaymentPackage = async (
  disbursements: Array<Disbursement>,
  releaseDate: Date,
  packageName: string
) => {
  // Note: Lambda can only write to the /tmp/ folder. On local windows machines c:/tmp
  const outFilePath = `/tmp/${packageName}.zip`;

  // Build manifest file
  const manifestFileName = `${packageName}.TXT`;
  const { manifestFileContent, mappedDocuments } = VPayFormatter.mapDisbursementToVpayFormat(
    disbursements,
    releaseDate
  );

  // Create .zip file
  const zip = new AdmZip();

  // Insert manifest to zip file
  zip.addFile(manifestFileName, Buffer.from(manifestFileContent, BufferEncodingTypes.Utf8), 'Payment manifest file');

  // Get and Add attached files to zip
  for (let i = 0; i < mappedDocuments.length; i++) {
    const { fileName, description, key } = mappedDocuments[i];

    // Get file from document-library
    const documentBody = await DocumentLib.getDocument(key);

    zip.addFile(
      fileName,
      Buffer.from(documentBody.toString(BufferEncodingTypes.Base64), BufferEncodingTypes.Base64),
      description,
      0
    );
  }

  zip.writeZip(outFilePath);

  return outFilePath;
};

/**
 * Get all product accounting definitions
 */
const getProductAccountingList = async (): Promise<Array<ProductAccounting>> => {
  const productAccountingList: Array<ProductAccounting> = [];

  const products = await ProductAPI.getProductList();

  for (const productKey of products) {
    const [productMain, productAccounting] = await ProductAPI.getConfiguration(productKey);
    productAccountingList.push(productAccounting);
  }

  return productAccountingList;
};
