
/**
 * BillingStatus
 * @class BillingStatus
 */
export class BillingStatus {
  lockStatus: BillingStatus.StatusType = BillingStatus.StatusType.None;
  paymentStatus: BillingStatus.PaymentStatus = BillingStatus.PaymentStatus.PaymentInitiated;
  delinquencyStatus: BillingStatus.DelinquencyStatus = BillingStatus.DelinquencyStatus.DelinquencyProcessNotStarted;
  invoiceStatus: BillingStatus.InvoiceStatus = BillingStatus.InvoiceStatus.Pending;

  /**
   * Initializes a new instance of the @see {BillingStatus} class.
   * @param src The source record.
   */
  constructor(src?: any) {
    if (src) {
      this.lockStatus = src.lockStatus;
      this.paymentStatus = src.paymentStatus;
      this.delinquencyStatus = src.delinquencyStatus;
      this.invoiceStatus = src.invoiceStatus;
    }
  }
}

export namespace BillingStatus {
  /**
   * Status values.
   */
  export enum StatusType {
    None = 'None',
    InProcess = 'InProcess',
    Error = 'Error',
  }

  export enum PaymentStatus {    
    PaymentInitiated = 'PaymentInitiated',
    PaymentInProcess = 'PaymentInProcess',
    PaymentCompleted = 'PaymentCompleted',
    PaymentFailure = 'PaymentFailure'
  }

  export enum DelinquencyStatus {
    DelinquencyProcessStarted = 'DelinquencyProcessStarted',
    DelinquencyProcessNotStarted = 'DelinquencyProcessNotStarted',
    DelinquencyCompleted = 'DelinquencyCompleted'
  }

  /*
  * Invoice Status to check if it was send.
  */
  export enum InvoiceStatus {
    Pending = 'Pending',
    Sent = 'Sent',
    Error = 'Error'
  }
}
