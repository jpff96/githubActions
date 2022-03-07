import * as Client from 'ssh2-sftp-client';
import * as fs from 'fs';
import * as readline from 'readline';
import { logError } from '../../../libs/logLib';
import { EntityAPI } from '../../../libs/API/EntityAPI';
import { Configuration } from '../../../libs/constLib';
import { BufferEncodingTypes, FileExtension } from '../../../libs/enumLib';
import { VPayParser } from './VPayParser';
import { VPayTransaction } from './models/VPayTransaction';
import { VPayTransactionPackage } from './models/VPayTransactionPackage';

/**
 * Download VPay reconciliation files
 * @param entityId  The entity id.
 */
export const download = async (entityId: string): Promise<Array<VPayTransactionPackage>> => {
  try {
    const transactionsPackage: Array<VPayTransactionPackage> = [];

    const config = await EntityAPI.getApiConfig(entityId, Configuration.API_SIG);
    const { host, pwd, uid } = config?.settings?.vPay || {};

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

      // List and filter files
      const fileList = await sftp.list('./outbound', FileExtension.Txt);

      for (const file of fileList) {
        const fileName = file.name;

        // Get and read file
        await sftp.fastGet(`./outbound/${fileName}`, `/tmp/${fileName}`);
        const readableStream = fs.createReadStream(`/tmp/${fileName}`, { encoding: BufferEncodingTypes.Utf8 });

        // Read lines
        const readableLines = readline.createInterface({
          input: readableStream,
          crlfDelay: Infinity
        });

        const isRejected = fileName.toLowerCase().includes(VPayParser.VPayFileType.Rejected);
        const transactions: Array<VPayTransaction> = [];

        for await (const line of readableLines) {
          const transaction = VPayParser.parseVPayLineToTransaction(line, isRejected);

          if (transaction) {
            transactions.push(transaction);
          }
        }

        transactionsPackage.push(new VPayTransactionPackage({
          transactions: transactions,
          fileName: fileName
        }));
      }

      return transactionsPackage;
    } catch (ex) {
      logError(console.log, ex, 'processSFTP_ERROR');
    } finally {
      if (sftp) {
        await sftp.end();
      }
    }
  } catch (ex) {
    logError(console.log, ex, 'recon_download_ERROR');
  }
};
