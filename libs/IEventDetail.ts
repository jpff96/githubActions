import { BalanceDue } from '../handlers/accounting/v1/models/BalanceDue';
import { PaymentPlan } from '../handlers/accounting/v1/models/PaymentPlan';
import { DisbursementEventPayload } from '../handlers/disbursement/v1/models';
import { ValidationError } from './errors/ValidationError';

/**
 * Interface IEventDetail
 */
export interface IEventDetail {
  key?: any;
}

/**
 * Interface IPaymentEvent
 */
export interface IPaymentEvent extends IEventDetail {
  policyPayment?: any;
  mainBalanceDue?: BalanceDue 
  companionBalanceDue?: BalanceDue 
}

/**
 * Interface IDisbursementCreatedEvent
 */
export interface IDisbursementCreatedEvent extends IEventDetail {
  disbursement: DisbursementEventPayload;
  isSuccess?: boolean;
}

/**
 * Interface IDisbursementEditEvent
 */
export interface IDisbursementEditEvent extends IEventDetail {
  disbursement: DisbursementEventPayload;
}

/**
 * Interface IDisbursementStatusChangeEvent
 */
export interface IDisbursementStatusChangeEvent extends IEventDetail {
  disbursement: DisbursementEventPayload;
}

/**
 * Interface INotificationEvent
 */
 export interface INotificationEvent extends IEventDetail {
  referenceId?: string;
  referenceType?: string;
  responseDetailType?: string;
  emailConfig?: any;
}
