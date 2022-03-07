import * as AdmZip from 'adm-zip';
import * as path from 'path';
import * as Client from 'ssh2-sftp-client';
import * as stream from 'stream';
import * as util from 'util';
import { safeTrim } from '@eclipsetechnology/eclipse-api-helpers';
import { client } from '../../../../libs/dynamodb';
import { InvalidFileStructure } from '../../../../libs/errors/InvalidFileStructure';
import { LockboxRepository } from '../LockboxRepository';
import { Batch } from '../models/Batch';
import { ErrorCodes } from '../../../../libs/errors/ErrorCodes';
import { CheckTransaction } from '../models/CheckTransaction';
import { Image } from '../models/Image';
import { MediaPayload } from '@eclipsetechnology/media-library/dist/models/MediaPayload';
import { MediaAPI } from '../../../../libs/API/MediaAPI';
import * as sharp from 'sharp';
import { LoggerInfo } from '@eclipsetechnology/eclipse-api-helpers/dist/models/LoggerInfo';
import { logTrace } from '@eclipsetechnology/eclipse-api-helpers';

/**
 * @class SFTP
 */
export class SFTP {
  host: string = '';
  username: string = '';
  pwd: string = '';
  path: string = '';
  entity: string = '';
  privateKey: string = '';

  private ContentEncodingBase64: BufferEncoding = 'base64';

  /**
   * Initializes a new instance of the @see SFTP class.
   * @param src
   */
  constructor(src?: any) {
    if (src) {
      this.host = src.host;
      this.username = src.username;
      this.pwd = src.pwd;
      this.path = src.path;
      this.entity = src.entity;
      this.privateKey = src.privateKey;
    }
  }

  /**
   * Connect to SFTP defined by entity config and process lockbox files.
   *
   */
  public processSFTP = async (): Promise<Batch> => {
    const loggerInfo = new LoggerInfo(console.log, String(process.env.PAYMENT_ENABLE_TRACE).toLowerCase() === 'true');

    const sftp = new Client();

    try {
      const sftpCommonOpts = {
        host: this.host,
        username: this.username,
        password: this.pwd,
        privateKey: this.privateKey,
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
      logTrace(loggerInfo, '🚀', 'processSFTP', sftpCommonOpts);

      await sftp.connect(sftpCommonOpts);

      // Process directory
      return await this.processDirectory(sftp);
    } catch (ex) {
      console.error(ex);
    } finally {
      if (sftp) {
        await sftp.end();
      }
    }
  };

  /**
   * Read the directory on SFTP server and process files.
   *
   * @param sftp
   * @param directoryPath
   */
  private processDirectory = async (sftp: Client): Promise<Batch> => {
    let batch: Batch = null;
    const repository = new LockboxRepository(client);
    const dirList = await sftp.list(this.path);

    // Filter to remove all but files
    const fileList = dirList.filter((x) => x.type === SFTP.SFTPItemType.File);

    // TODO - what if more than 1 batch set?
    if (fileList.length > 0) {
      // Get the posting file to process first
      const file = fileList.find(
        (x) =>
          path.extname(x.name).toUpperCase() === SFTP.FileExtensionType.Csv &&
          path.basename(x.name).toUpperCase().includes('_INDEX') === false
      );

      if (file) {
        const { name: fileName } = file;
        let sftpFileData = await this.getSftpFileData(sftp, fileName, this.path);
        let csv = Buffer.from(sftpFileData, this.ContentEncodingBase64).toString();
        let lines = csv.split('\r\n');

        if (lines) {
          batch = await this.processPostingFile(fileName, lines);
        }

        // Index File
        const indexFileInfo = fileList.find(
          (x) =>
            path.extname(x.name).toUpperCase() === SFTP.FileExtensionType.Csv &&
            path.basename(x.name).toUpperCase().includes('_INDEX') === true
        );

        if (indexFileInfo?.name) {
          sftpFileData = await this.getSftpFileData(sftp, indexFileInfo.name, this.path);
          csv = Buffer.from(sftpFileData, this.ContentEncodingBase64).toString();
          lines = csv.split('\r\n');

          if (lines) {
            await this.processIndexFile(batch, indexFileInfo.name, lines);
          }
        }

        // Get Image ZIP file and process
        const zipFileInfo = fileList.find((x) => path.extname(x.name).toUpperCase() === SFTP.FileExtensionType.Zip);

        if (zipFileInfo?.name) {
          const buffer: Buffer = (await sftp.get(`${this.path}/${zipFileInfo.name}`)) as Buffer;

          if (buffer) {
            const zip = new AdmZip(buffer);
            const zipEntries = zip.getEntries();

            for (const trans of batch.transactions) {
              for (const image of trans.images) {
                if (image.name) {
                  const zipEntry = zipEntries.find((x) => x.entryName.toUpperCase() === image.name.toUpperCase());

                  if (zipEntry) {
                    await this.processImageFile(image, zipEntry.getData());
                  }
                }
              }
            }
          }
        }

        await repository.saveBatch(batch);

        await this.moveToProcessed(sftp, fileName);
        await this.moveToProcessed(sftp, indexFileInfo?.name);
        await this.moveToProcessed(sftp, zipFileInfo?.name);
      }
    }

    return batch;
  };

  /**
   * Process a posting file by parsing it and creating a new batch record.
   * @param repository
   * @param fileName
   * @param lines The file broken into lines.
   */
  private processPostingFile = async (fileName: string, lines: string[]): Promise<Batch> => {
    const batch = new Batch();
    batch.entityId = this.entity;
    batch.lockbox = 'OpenHouse'; // TODO - what should this really be?

    for (const line of lines) {
      const detail = line.trim().split(',');

      switch (detail[0]) {
        case 'H':
          console.log('H', detail);
          this.verifyNumberOfFields(detail, 4);
          batch.account = detail[1];
          batch.processDate = this.parseDate(detail[3]);
          batch.batchId = detail[3];
          break;

        case 'D':
          console.log('D', detail);
          this.verifyNumberOfFields(detail, 11);
          const policyNumber = this.convertPolicyNumber(detail[1]);
          const transaction = new CheckTransaction();
          transaction.policyId = LockboxRepository.buildPolicyId(this.entity, policyNumber);
          transaction.policyNumber = policyNumber;
          transaction.invoiceNumber = detail[2];
          transaction.isMortgagee = detail[3].toUpperCase() === 'M';
          transaction.loanNumber = detail[4];
          transaction.dueDate = this.parseDate(detail[5]);
          transaction.postMarkDate = this.parseDate(detail[6]);
          transaction.checkAmount = this.convertAmount(detail[7]);
          transaction.amount = this.convertAmount(detail[7]); // TODO - set amount correctly
          transaction.checkNumber = Number(detail[8]);
          transaction.referenceId = detail[9]; // use transaction number from Bill2Pay
          transaction.transactionId = detail[10]; // use DRN (Digital Reference Number) from Bill2Pay

          batch.transactions.push(transaction);
          break;

        case 'T':
          console.log('T', detail);
          this.verifyNumberOfFields(detail, 3);
          const detailCount = Number(detail[1]);
          batch.suspenseCount = detailCount;

          if (detailCount !== batch.transactions.length) {
            throw new InvalidFileStructure(
              ErrorCodes.InvalidFileStructure,
              `Expected ${detailCount} detail records, found ${batch.transactions.length}.`
            );
          }

          batch.totalAmount = this.convertAmount(detail[2]);
          break;
      }
    }

    return batch;
  };

  /**
   * Process the index file for correspondence.
   * @param repository
   * @param batch
   * @param fileName
   * @param lines The file broken into lines.
   */
  private processIndexFile = async (batch: Batch, fileName: string, lines: string[]): Promise<Batch> => {
    for (const line of lines) {
      const detail = line.trim().split(',');

      switch (detail[0]) {
        case 'H':
          console.log('H', detail);
          this.verifyNumberOfFields(detail, 4);
          const fileFormat = detail[2];

          if (fileFormat !== 'INDEX') {
            throw new InvalidFileStructure(ErrorCodes.InvalidFileStructure, 'File format is not INDEX');
          }
          break;

        case 'D':
          console.log('D', detail);
          this.verifyNumberOfFields(detail, 13);

          if (detail[1] === '999999999999' && detail[4] === '') {
            // TODO - process correspondence record
            console.log('Correspondence', detail);
          } else {
            // Handle image name and DRN match
            const trans = batch.transactions.find((x) => x.transactionId === detail[10]);

            if (trans) {
              trans.images.push(new Image(Image.Sides.Front, null, detail[11]));
              trans.images.push(new Image(Image.Sides.Back, null, detail[12]));
            } else {
              // Handle check image that needs to be associated with possible multiple policies
              const transactions = batch.transactions.filter((x) => x.referenceId === detail[9]);

              for (const tran of transactions) {
                tran.images.push(new Image(Image.Sides.Front, null, detail[11]));
                tran.images.push(new Image(Image.Sides.Back, null, detail[12]));
              }
            }
          }
          break;

        case 'T':
          console.log('T', detail);
          this.verifyNumberOfFields(detail, 2);
          const detailCount = Number(detail[1]);

          if (detailCount < batch.transactions.length) {
            throw new InvalidFileStructure(
              ErrorCodes.InvalidFileStructure,
              `Expected ${detailCount} detail records, found ${batch.transactions.length}.`
            );
          }
          break;
      }
    }

    return batch;
  };

  /**
   * Process the image file
   * @param image
   * @param data
   */

  private processImageFile = async (image: Image, data: Buffer) => {
    // Convert image from tiff to png
    const pngBuffer = await sharp(data).png().toBuffer();

    // Upload to S3
    const media = pngBuffer.toString(this.ContentEncodingBase64);
    const contentType = 'image/png';
    const metadata = {};
    const mediaPayload = new MediaPayload({
      media,
      contentType,
      metadata
    });
    const mediaInfo = await MediaAPI.uploadBase64Media(mediaPayload, this.entity);

    // Save image info to correct transaction in the batch
    const imageName = image.name.replace('.TIF', '.png');
    image.name = imageName;
    image.token = mediaInfo.token;
  };

  /**
   * Moves file into the processed sub folder
   * @param sftp FTP client
   * @param indexFile File name to move
   */
  private moveToProcessed = async (sftp: Client, indexFile: string) => {
    if (indexFile) {
      const procPath = `${this.path}/processed`;

      if ((await sftp.exists(procPath)) === false) {
        await sftp.mkdir(`${this.path}/processed`);
      }

      await sftp.rename(`${this.path}/${indexFile}`, `${this.path}/processed/${indexFile}`);
    }
  };

  /**
   * Verifies the minimum length of the array for parsing.
   * @param values
   * @param count
   */
  private verifyNumberOfFields(values: Array<string>, count: number) {
    if (values?.length < count) {
      throw new InvalidFileStructure(
        ErrorCodes.InvalidFileStructure,
        `Line ${values} does not contain the correct number of fields. Expected: ${count}, Actual: ${values?.length}`
      );
    }
  }

  /**
   * Load information from the file into a string
   *
   * @param sftp
   * @param fileName
   * @param directoryPath
   */
  private getSftpFileData = async (sftp: any, fileName: string, directoryPath: string): Promise<string> => {
    let sftpFileData: string = '';

    // Get file from SFTP into Memory stream
    function MemoryStream() {
      stream.Writable.call(this);
    }
    util.inherits(MemoryStream, stream.Writable);
    MemoryStream.prototype._write = function (chunk, contentEncoding, done) {
      sftpFileData += chunk.toString();
      done();
    };
    const myStream = new MemoryStream();

    await sftp.get(`${directoryPath}/${fileName}`, myStream, {
      encoding: this.ContentEncodingBase64
    });

    return sftpFileData;
  };

  /**
   * Parse the date out of the string
   *
   * @param rawDate
   */
  private parseDate = (rawDate: string) => {
    const year = safeTrim(rawDate.substr(0, 4));
    const month = safeTrim(rawDate.substr(4, 2));
    const day = safeTrim(rawDate.substr(6, 2));

    return `${year}-${month}-${day}`;
  };

  /**
   * Convert amounts to decimal values
   *
   * @param wholeAmount
   */
  private convertAmount = (wholeAmount: string) => {
    const num = Number(wholeAmount);

    if (isNaN(num)) {
      throw new InvalidFileStructure(ErrorCodes.InvalidAmountValue, `The value ${wholeAmount} is not a valid amount.`);
    }

    return num / 100;
  };

  /**
   * Converts the policy number string to include the -.
   * @param policyNumber
   */
  private convertPolicyNumber(policyNumber: string) {
    if (policyNumber === '99999999999' || policyNumber === '') {
      return policyNumber;
    }

    return policyNumber.slice(0, 2) + '-' + policyNumber.slice(2);
  }
}

export namespace SFTP {
  export enum FileExtensionType {
    Csv = '.CSV',
    Zip = '.ZIP'
  }
  export const SFTPItemType = {
    File: '-'
  };

  export enum FileContentType {
    POSTING = 'POSTING',
    INDEX = 'INDEX'
  }
}
