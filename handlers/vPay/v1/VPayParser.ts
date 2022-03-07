import { Disbursement } from '../../disbursement/v1/models';
import { VPayTransaction } from './models/VPayTransaction';

/**
 * VPayParser
 * @abstract @class VPayParser
 */
export abstract class VPayParser {
  /**
   * Parse VPay line from outbound file
   * @param line        The line to parse.
   * @param isRejected  Rejected file flag.
   */
  static parseVPayLineToTransaction = (line: string, isRejected: boolean): VPayTransaction => {
    let transaction: VPayTransaction;
    line = line.replace(/ /g, '');
    const fields = line.split('|');

    if (isRejected) {
      transaction = new VPayTransaction();
      transaction.disbursementId = fields[VPayParser.VPayTransactionRejectedFields.DisbursementId].replace(/"/g, '');
      transaction.rejectReason = fields[VPayParser.VPayTransactionRejectedFields.RejectReason];
      transaction.status = Disbursement.States.ProviderError;
      transaction.transactionDateTime = VPayParser.parseDateTime(fields[VPayParser.VPayTransactionRejectedFields.DateOfTransactionTs]);
    } else {
      if (fields[VPayParser.VPayTransactionFields.RecordType] === VPayParser.VPayLineType.Transaction) {
        const status = VPayParser.mapStatus(fields[VPayParser.VPayTransactionFields.Status],
          fields[VPayParser.VPayTransactionFields.ReasonCode]);

        if (status) {
          transaction = new VPayTransaction();
          transaction.status = status;
          transaction.vPayPaymentType = fields[VPayParser.VPayTransactionFields.PaymentType];
          transaction.vPayTransactionId = fields[VPayParser.VPayTransactionFields.TransactionId];
          transaction.loadAmount = VPayParser.parseNumber(fields[VPayParser.VPayTransactionFields.LoadAmount]);
          transaction.checkNumber = fields[VPayParser.VPayTransactionFields.PositivePay];
          transaction.transactionDateTime = VPayParser.parseDateTime(fields[VPayParser.VPayTransactionFields.DateOfTransactionTs]);
          transaction.transactionAmount = VPayParser.parseNumber(fields[VPayParser.VPayTransactionFields.TransactionAmount]);
          transaction.currentBalance = VPayParser.parseNumber(fields[VPayParser.VPayTransactionFields.CurrentBalance]);
          transaction.claimId = fields[VPayParser.VPayTransactionFields.ClaimId];
          transaction.referenceId = fields[VPayParser.VPayTransactionFields.ClientReferenceId];
          transaction.disbursementId = fields[VPayParser.VPayTransactionFields.UserKey];
          transaction.fundingAccount = fields[VPayParser.VPayTransactionFields.ClientGroupId];
          transaction.mailingClass = fields[VPayParser.VPayTransactionFields.MailingClass];
          transaction.mailingTrackingNumber = fields[VPayParser.VPayTransactionFields.MailingTrackingNumber];
        }
      }
    }

    return transaction;
  }

  /**
   * Parse VPay number value from outbound file
   * @param value
   */
  static parseNumber = (value: string): number => {
    return Number(value) || 0;
  }

  /**
   * Parse VPay datetime value from outbound file
   * @param value
   */
  static parseDateTime = (value: string): string => {
    const date = value.substr(0, 10);
    const hours = value.substr(11, 2);
    const minutes = value.substr(14, 2);
    const seconds = value.substr(17, 2);
    const milliseconds = value.substr(20, 3);

    return `${date}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
  }

  /**
   * Map VPay status to disbursement one
   * @param status
   * @param reasonCode
   */
  static mapStatus = (status: string, reasonCode: string): string => {
    let disbursementStatus: Disbursement.States = null;

    switch (status) {
      case VPayParser.VPayStatus.Loaded:
        disbursementStatus = Disbursement.States.ProviderProcessed;
        break;
      case VPayParser.VPayStatus.DistFax:
      case VPayParser.VPayStatus.DistUSPS:
      case VPayParser.VPayStatus.DistFedex:
      case VPayParser.VPayStatus.DistUPS:
      case VPayParser.VPayStatus.DistEmail:
        disbursementStatus = Disbursement.States.Mailed;
        break;
      case VPayParser.VPayStatus.Unload:
        if (reasonCode === VPayParser.VPayReasonCode.Voided) {
          disbursementStatus = Disbursement.States.ProviderVoided;
        } else if (reasonCode === VPayParser.VPayReasonCode.Reissued) {
          disbursementStatus = Disbursement.States.ProviderReissued;
        }
        break;
      case VPayParser.VPayStatus.Purchase:
        disbursementStatus = Disbursement.States.Cleared;
        break;
      default:
        break;
    }

    return disbursementStatus;
  }
}

export namespace VPayParser {
  /**
   * VPay line types from outbound files
   * @enum VPayLineType
   */
  export enum VPayLineType {
    Header = 'VP000',
    Transaction = 'VP001',
    Trailer = 'VP999'
  };

  /**
   * VPay transaction fields from outbound files
   * @enum VPayTransactionFields
   */
  export enum VPayTransactionFields {
    RecordType,
    BatchId,
    RecordNumber,
    Origin,
    ClientTPACode,
    BillingEntityId,
    BasePaymentType,
    PaymentType,
    TransactionId,
    LoadRequestTS,
    LoadTS,
    LoadAmount,
    LoadCurrency,
    PaymentSpecificData,
    PositivePay,
    AssociationOrBank,
    TypeOfStatus,
    Status,
    ReasonCode,
    InternalTransactionId,
    DateOfTransactionTs,
    TransactionTS,
    TransactionAmount,
    TransactionCurrency,
    CurrentBalance,
    PayeeName,
    ClaimId,
    GroupNumber,
    ClaimData,
    ClientBankInfo,
    BankRoutingInfo,
    PaymentData,
    BillingEntityFullName,
    ClientReferenceId,
    UserKey,
    ClientGroupId,
    MailingClass,
    MailingTrackingNumber,
    ACHId,
    OriginalLoadRequestAmount
  };

  /**
   * VPay transaction fields from rejected outbound files
   * @enum VPayTransactionRejectedFields
   */
  export enum VPayTransactionRejectedFields {
    DisbursementId,
    RejectReason,
    Type,
    FileName,
    DateOfTransactionTs
  };

  /**
   * VPay status
   * @enum VPayStatus
   */
  export enum VPayStatus {
    Requested = 'REQUESTED',
    Loaded = 'LOADED',
    DistFax = 'DISTFAX',
    DistUSPS = 'DISTUSPS',
    DistFedex = 'DISTFEDEX',
    DistUPS = 'DISTUPS',
    DistEmail = 'DISTEMAIL',
    Unload = 'UNLOAD',
    Purchase = 'PURCHASE'
  }

  /**
   * VPay reason code
   * @enum VPayReasonCode
   */
  export enum VPayReasonCode {
    Voided = '4026',
    Reissued = '4001'
  }

  /**
   * VPay file type
   * @enum VPayFileType
   */
  export enum VPayFileType {
    Rejected = 'rejected'
  }
}
