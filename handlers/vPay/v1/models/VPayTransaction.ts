/**
 * Information used to represent outbound transaction
 */
export class VPayTransaction {
  vPayPaymentType: string;
  vPayTransactionId: string;
  loadAmount: number;
  checkNumber: string;
  status: string;
  reasonCode: string;
  transactionDateTime: string;
  transactionAmount: number;
  currentBalance: number;
  claimId: string;
  referenceId: string;
  disbursementId: string;
  fundingAccount: string;
  mailingClass: string;
  mailingTrackingNumber: string;
  rejectReason: string;
}
