import { ScheduledEvent, ScheduledHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import { EntityAPI } from '../../../../libs/API/EntityAPI';
import { client } from '../../../../libs/dynamodb';
import { LockboxRepository } from '../LockboxRepository';
import { BatchHelper } from './BatchHelper';
import { SFTP } from './SFTP';

/**
 * Main entry point for the lockbox CRON job.
 * @param event Event data.
 */
export const main: ScheduledHandler = async (event: ScheduledEvent): Promise<void> => {
  try {
    const ftpList = await getFtpList();

    for (const data of ftpList) {
      const sftp = new SFTP(data);
      const batch = await sftp.processSFTP();

      if (batch) {
        const repository = new LockboxRepository(client);
        await BatchHelper.checkMatches(batch);
        // We save before the release so if an error occurs we don't lose the batch up to that point.
        await repository.saveBatch(batch);

        // After all the transaction has been checked we release the batch so matched transactions
        // can be released automatically.
        await BatchHelper.releaseBatch(batch);
        await repository.saveBatch(batch);
      }
    }
  } catch (ex) {
    console.error(ex);

    throw ex;
  }
};

/**
 * Gets the list of SFTP servers to check based on the entity configuration
 */
const getFtpList = async (): Promise<Array<any>> => {
  const configList = await EntityAPI.listApiConfig(EntityAPI.ServiceKey.Payment);

  // Load up the working set of SFTP servers for each entity
  const ftpList = [];

  for (const config of configList) {
    const {
      entity,
      settings: { lockbox }
    } = config;

    if (lockbox) {
      const { bill2PaySFTP, isEnabled } = lockbox;

      if (bill2PaySFTP && isEnabled === true) {
        let { host, path, uid: username, pwd } = bill2PaySFTP;
        let privateKey: string;

        if (!path) {
          path = '.';
        }

        if (pwd.startsWith('PuTTY')) {
          privateKey = pwd;
          pwd = null;
        }

        // Temp
        // Private Key
        // path = '/sftp-equinox-insure';
        // pwd =
        //   'PuTTY-User-Key-File-2: ssh-rsa\r\nEncryption: none\r\nComment: rsa-key-20210302\r\nPublic-Lines: 6\r\nAAAAB3NzaC1yc2EAAAABJQAAAQEAo3h/CqgbgQI9KYlF3/dTli7yo9DfX5WmSz4EkdCfdYmMx8s+Sc254B2c8YNdPuHEMhAEwRnL87F/bqowQuVxeiN646SWUKns2MuAlbDlUPKmeBdVx6+0+8XqPgOVQTx1DmlrTZYAYL7BN3xvItZes1BIKq5QVulsnGYP/tRhUJHzg7+B2pWYcyKIVy7Ns4pq7JkpQlpLqmISrMj9w20jTMUwz3u+vBA1872ulUNiVka1gv0AWHUIfj8LNM2Q+aqTk8w/NPq2c6XqASmZd1VaTWKjL2vNNV0GVxV5Oa3Mzaxo5wZl6C7P5GUt6f9XLVbjQ+CrKce0txWjsdZsw91ndQ==\r\nPrivate-Lines: 14\r\nAAABAEsbr/36NiaEfPdolbnuLVLXTON7pOa6YSl9XAulCv6m+35kTQ0nK+ODOkVztTiRPnfd2Ku/vpKP0sQkrmPs4RxxKp/xrNj0ILaisLN6yjny8oo0PCtQuvA4Vt44/2MpnZEAAN51Wh6c1VDYTrz6teOvQ8CVR4Hg3uATN8gcZBBCUqJ+P9fyynPFgcIIth0mBeIQLZ/Pc4uaDTbJKwfs8FnMhDUpXiq6hI/SqYqPfqbMysAi9090WGhOqIixv2Y21a5IVnp3axC2T11ZDTkjIupPPEq1Q+Xy4MoVvTfdvC7LVYvYzl7+3e4GGQPK9gIPcJJJs4JNS5FYWB7vBAUEUOkAAACBANppjKP+DxeZO6hGCqhi8WoyXr738GcGFDRThy0OHO8+ok7M4H9OAPbupZ2v3Of1+u7/+SUU60qGH7yyNLReqmfRBtqUIuUXFAaRyf+csDn3SzpAHMlbVQHW6PjQIIqFLTx7f0NKE+QgmkFeMqv1VT/agMBbCHklyRZnzZm+c1D/AAAAgQC/mmth93YTg5NcPafGIDcwKI+so0wHR0nftNdF4EyDSrENjubb4+K1F1yf5QD9T50cSj9Ih4yFFRnBlVI8B9QedKBsLOL3ZV9y73+qQCt5/cVPH4hC5Y39IrHklZuZpmpFDfqOoixyJycQdHxXjeAIwZJVDYBp64xF96ZCvkKTiwAAAIAsbNimtuwdh/YgFaT3Kbm0Rgm6tkpdUrPmyun4zHFucgpTONewoVtAbZE3eg/u6TSPJqx5bjskKm9lO/XmGaUJQQVJBaUv2gzed4AhiL9Qc6019OQyb7eYpL6/GoFIzPU/WDeKjug2bt9Fzc8OHU74s9nB1fh98UlwdHkZF6lQZA==\r\nPrivate-MAC: 5b3cb45f1ef79166610b3eac1cfc1aece8134ca4';
        // const keyStorageBucketName = 'dev.equinox-key-storage';
        // const s3Bucket = new AWS.S3({
        //   params: { Bucket: keyStorageBucketName }
        // });

        // const ppkFileResult = await s3Bucket
        //   .getObject({
        //     Bucket: keyStorageBucketName,
        //     Key: 'solstice-test-sftp-tg.ppk'
        //   })
        //   .promise();
        // pwd = ppkFileResult.Body.toString();
        // host = 'sftp.solstice.tech';
        // username = 'solstice-test';

        // END Temp

        ftpList.push({
          entity,
          host,
          username,
          pwd,
          privateKey,
          path
        });
      }
    }
  }

  return ftpList;
};

// {"token":"2fbf6306-63fe-4cee-99a6-2175d4508e46","key":"/Accounting/217bbfa0-8637-483e-bd6d-e0e904218607","contentType":"image/png","metadata":{"fileName":"myFileName.png","source":"Accounting","uploadType":"base64"}}
const batches = [
  {
    pk: '',
    sk: 'Batch',
    batchId: '001',
    entityId: '00000000-0000-0000-0000-000000000005',
    lockbox: 'OpenHouse',
    account: 'OH5',
    totalAmount: 300.33,
    processDate: '2020-12-21',
    suspenseCount: 3,
    approvedCount: 0,
    status: 'Suspense',
    lastActionBy: '',
    lastActionDate: '',
    transactions: [
      {
        checkNumber: 1001,
        checkAmount: 300.33,
        postMarkDate: '2020-12-15',
        images: [
          {
            side: 'Front',
            token: '2fbf6306-63fe-4cee-99a6-2175d4508e46',
            name: 'fileName.tiff'
          },
          {
            side: 'Back',
            token: '2fbf6306-63fe-4cee-99a6-2175d4508e46',
            name: 'fileName.tiff'
          }
        ],
        amount: 100.33,
        invoiceNumber: '',
        policyNumber: 'OH-000002191',
        dueDate: '',
        appliedDate: '2020-12-21',
        transactionId: '00001',
        referenceId: '202012210000100001',
        status: 'Suspense',
        note: '',
        errors: ['Invoice']
      },
      {
        checkNumber: 1001,
        checkAmount: 300.33,
        postMarkDate: '2020-12-15',
        images: [
          {
            side: 'Front',
            token: '2fbf6306-63fe-4cee-99a6-2175d4508e46',
            name: 'fileName.tiff'
          },
          {
            side: 'Back',
            token: '2fbf6306-63fe-4cee-99a6-2175d4508e46',
            name: 'fileName.tiff'
          }
        ],
        amount: 199.0,
        invoiceNumber: '',
        policyNumber: '',
        dueDate: '',
        appliedDate: '2020-12-21',
        transactionId: '00001',
        referenceId: '202012210000100003',
        status: 'Suspense',
        note: '',
        errors: ['Policy', 'Amount']
      },
      {
        checkNumber: 102,
        checkAmount: 17.14,
        postMarkDate: '2020-12-15',
        images: [
          {
            side: 'Front',
            token: '2fbf6306-63fe-4cee-99a6-2175d4508e46',
            name: 'fileName.tiff'
          },
          {
            side: 'Back',
            token: '2fbf6306-63fe-4cee-99a6-2175d4508e46',
            name: 'fileName.tiff'
          }
        ],
        amount: 17.14,
        invoiceNumber: '',
        policyNumber: 'OH-000002189',
        dueDate: '',
        appliedDate: '2020-12-21',
        transactionId: '00002',
        referenceId: '202012210000200001',
        status: 'Matched',
        note: ''
      }
    ],
    documents: []
  },
  {
    pk: '',
    sk: 'Batch',
    batchId: '002',
    entityId: '00000000-0000-0000-0000-000000000005',
    lockbox: 'OpenHouse',
    account: 'OH5',
    totalAmount: 300.33,
    processDate: '2020-12-21',
    suspenseCount: 0,
    approvedCount: 2,
    status: 'Balanced',
    lastActionBy: '',
    lastActionDate: '',
    transactions: [
      {
        checkNumber: 1002,
        checkAmount: 600.66,
        postMarkDate: '2020-12-15',
        images: [
          {
            side: 'Front',
            token: 'MediaLibToken',
            name: 'fileName.tiff'
          },
          {
            side: 'Back',
            token: 'MediaLibToken',
            name: 'fileName.tiff'
          }
        ],
        amount: 400.33,
        invoiceNumber: '',
        policyNumber: 'OH-000002191',
        dueDate: '',
        appliedDate: '2020-12-21',
        transactionId: '00001',
        referenceId: '202012210000100001',
        status: 'Approved',
        note: ''
      },
      {
        checkNumber: 1002,
        checkAmount: 600.33,
        postMarkDate: '2020-12-15',
        images: [
          {
            side: 'Front',
            token: 'MediaLibToken',
            name: 'fileName.tiff'
          },
          {
            side: 'Back',
            token: 'MediaLibToken',
            name: 'fileName.tiff'
          }
        ],
        amount: 200.33,
        invoiceNumber: '',
        policyNumber: 'OH-000002190',
        dueDate: '',
        appliedDate: '2020-12-21',
        transactionId: '00002',
        referenceId: '202012210000100003',
        status: 'Approved',
        note: ''
      }
    ],
    documents: []
  },
  {
    pk: '',
    sk: 'Batch',
    batchId: '003',
    entityId: '00000000-0000-0000-0000-000000000005',
    lockbox: 'OpenHouse',
    account: 'OH5',
    totalAmount: 300.33,
    processDate: '2020-12-21',
    suspenseCount: 3,
    approvedCount: 0,
    status: 'Released',
    lastActionBy: '',
    lastActionDate: '',
    transactions: [
      {
        checkNumber: 1002,
        checkAmount: 600.66,
        postMarkDate: '2020-12-15',
        images: [
          {
            side: 'Front',
            token: 'MediaLibToken',
            name: 'fileName.tiff'
          },
          {
            side: 'Back',
            token: 'MediaLibToken',
            name: 'fileName.tiff'
          }
        ],
        amount: 400.33,
        invoiceNumber: '',
        policyNumber: 'OH-000002191',
        dueDate: '',
        appliedDate: '2020-12-21',
        transactionId: '00001',
        referenceId: '202012210000100001',
        status: 'Approved',
        note: ''
      },
      {
        checkNumber: 1002,
        checkAmount: 600.33,
        postMarkDate: '2020-12-15',
        images: [
          {
            side: 'Front',
            token: 'MediaLibToken',
            name: 'fileName.tiff'
          },
          {
            side: 'Back',
            token: 'MediaLibToken',
            name: 'fileName.tiff'
          }
        ],
        amount: 200.33,
        invoiceNumber: '',
        policyNumber: 'OH-000002190',
        dueDate: '',
        appliedDate: '2020-12-21',
        transactionId: '00002',
        referenceId: '202012210000100003',
        status: 'Approved',
        note: ''
      }
    ],
    documents: []
  }
];
