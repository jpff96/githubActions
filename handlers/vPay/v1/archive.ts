import * as Client from 'ssh2-sftp-client';
import { logError } from '../../../libs/logLib';
import { EntityAPI } from '../../../libs/API/EntityAPI';
import { Configuration } from '../../../libs/constLib';

/**
 * Archive VPay reconciliation file
 * @param fileName  The file name.
 * @param entityId  The entity id.
 */
export const archive = async (fileName: string, entityId: string): Promise<void> => {
  try {
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
      await sftp.rename(`./outbound/${fileName}`, `./outbound/archive/${fileName}`);
    } catch (ex) {
      logError(console.log, ex, 'processSFTP_ERROR');
    } finally {
      if (sftp) {
        await sftp.end();
      }
    }
  } catch (ex) {
    logError(console.log, ex, 'recon_archive_ERROR');
  }
};
