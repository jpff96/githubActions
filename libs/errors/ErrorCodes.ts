/**
 * Error codes returned to the client for error reporting.
 */
export enum ErrorCodes {
  Unknown = 'Unknown',

  // Validation
  Validation = 'Validation',

  // Not ...
  NotFound = 'NotFound',
  NotInTenant = 'NotInTenant',

  // Arguments
  ArgumentMisMatch = 'ArgumentMisMatch',
  ArgumentInvalid = 'ArgumentInvalid',

  ResourceAlreadyExists = 'ResourceAlreadyExists',
  ActivityLogSendFailed = 'ActivityLogSendFailed',

  // Product
  ProductRequestFailed = 'ProductRequestFailed',
  ReservePaymentInfoNotFound = 'ReservePaymentInfoNotFound',

  // Bill2Pay
  MissingSecurityHeader = 'MissingSecurityHeader',
  InvalidData = 'InvalidData',
  PaymentMethodNotFound = 'PaymentMethodNotFound',
  InvalidFileStructure = 'InvalidFileStructure',
  InvalidAmountValue = 'InvalidAmountValue',

  // Lockbox
  NotBalanced = 'NotBalanced',
  NotReleased = 'NotReleased',

  // Search
  CriteriaNotFound = 'CriteriaNotFound'
}
