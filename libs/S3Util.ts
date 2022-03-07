import * as AWS from 'aws-sdk';

/**
 * Utility class to centralize S3 interaction
 */
export class S3Util {
  /**
   * Upload the object contained in the buffer to the S3 key/path location
   *
   * @param buffer A buffer containing the content to be stored
   * @param s3Key The path to the content in the S3 bucket
   * @param pdfOnly Flag to force PDF content type only (for uploading templates vs. normal files)
   */
  static upload = async (buffer: Buffer, s3Key: string, contentType: string): Promise<void> => {
    const s3RootBucket = process.env.DOCUMENT_STORAGE_BUCKET;

    const s3Bucket = new AWS.S3({
      params: { Bucket: s3RootBucket }
    });

    const s3Data = {
      Bucket: s3RootBucket,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType
    };

    await s3Bucket.putObject(s3Data).promise();
  };

  static fileTypes = {
    PDF: 'application/pdf'
  }
}
