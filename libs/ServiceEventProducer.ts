import * as AWS from 'aws-sdk';
import { ErrorResult } from '@eclipsetechnology/eclipse-api-helpers';
import { EntityAPI } from './API/EntityAPI';
import { QueueType, referenceType } from './enumLib';
import { ErrorCodes } from './errors/ErrorCodes';
import {
  IDisbursementCreatedEvent,
  IDisbursementStatusChangeEvent,
  IEventDetail,
  INotificationEvent,
  IPaymentEvent
} from './IEventDetail';
import Tenant from './Tenant';
import { Payment } from '../handlers/accounting/v1/models/Payment';
import { PremiumRefund } from '../handlers/accounting/v1/models/PremiumRefund';
import { Disbursement, DisbursementEventPayload } from '../handlers/disbursement/v1/models';
import { Statement } from '../handlers/accounting/v1/models/Statement';
import { BalanceDue } from '../handlers/accounting/v1/models/BalanceDue';
import { IDocumentCreateKeyInfo } from '@eclipsetechnology/document-library/dist/@types/IDocumentCreateKeyInfo';
import { ValidationError } from './errors/ValidationError';
import { PaymentPlan } from '../handlers/accounting/v1/models/PaymentPlan';

AWS.config.update({ region: process.env.AWS_SERVICE_REGION });

/**
 * Service Event Producer
 */
export class ServiceEventProducer {
  private static eventBridge = new AWS.EventBridge();
  /**
   * Sends a policy event to the event bus for processing.
   * @param eventDetail The detail the receiver needs to process the event.
   * @param detailType The action that defines this event.
   */
  static sendServiceEvent = async (eventDetail: IEventDetail, detailType: ServiceEventProducer.DetailType) => {
    try {
      const params = {
        Entries: [
          {
            Detail: JSON.stringify(eventDetail),
            DetailType: detailType,
            EventBusName: process.env.POLICY_EVENT_BUS_NAME,
            Source: ServiceEventProducer.SourceType.PaymentService
          }
        ]
      };

      const response = await ServiceEventProducer.eventBridge.putEvents(params).promise();

      // TODO - remove logging after tests are complete
      if (response) {
        console.log(`Sent payment event with id ${response.Entries[0].EventId}`);
      }

      return eventDetail.key?.referenceId;
    } catch (ex) {
      console.error(ex);

      throw new ErrorResult<ErrorCodes>(
        `Failed to send policy event to the event bus. ${ex.message}`,
        ErrorCodes.ActivityLogSendFailed
      );
    }
  };

  /**
   * Creates a payment detail object.
   * @param payment The payment data for the event.
   */
  static createPaymentEventDetail = (
    policyId: string,
    version: string,
    payment: Payment,
    ownerEntityId: string,
    typeDate?: string,
    mainBalanceDue?: BalanceDue,
    companionBalanceDue?: BalanceDue
  ): IPaymentEvent => {
    return {
      policyPayment: payment,
      mainBalanceDue: mainBalanceDue,
      companionBalanceDue: companionBalanceDue,
      key: {
        tenantEntityId: ownerEntityId,
        principalId: Tenant.principalId || Tenant.email || 'System',
        policyId: policyId,
        version: version,
        typeDate
      }
    };
  };

  /**
   * Creates a payment failure notification detail object.
   * @param entityId The entityId for the event.
   * @param email The email of the receiver.
   */
  static createPaymentFailureNotificationEventDetail = async (
    policyId: string,
    email: string,
    entityId?: string
  ): Promise<INotificationEvent> => {
    const configuration = await EntityAPI.getApiConfig(entityId, EntityAPI.ServiceKey.Notification);
    const emailConfig = configuration.settings.emailConfig[
      ServiceEventProducer.DetailType.PaymentFailureNotification
    ].map((emailConfig) => ({
      template: emailConfig.template,
      contactData: {
        sender: configuration.settings.from,
        receiver: email,
        title: emailConfig.subject
      },
      data: {}
    }));
    return {
      referenceId: policyId,
      referenceType: referenceType.Policy,
      emailConfig: emailConfig
    };
  };

  /**
   * Creates a statement detail object.
   * @param statement       The statement object.
   * @param tenantEntityId  The tenant entity id.
   * @param key             The incoming event key.
   */
  static createStatementEventDetail = (statement: Statement, tenantEntityId: string, key?: IDocumentCreateKeyInfo) => {
    return {
      statement,
      key: {
        tenantEntityId,
        policyId: statement.policyId,
        suppressPrint: key?.extraInfo?.suppressPrint,
        suppressNotification: key?.extraInfo?.suppressNotification
      }
    };
  };

  /**
   * Creates mid term change detail object.
   * @param policyId  The policyId.
   */
  static createMidTermChangePaymentEventDetail = (policyId: any, error?: Error) => {
    return {
      key: {
        tenantEntityId: Tenant.tenantEntityId,
        policyId: policyId
      },
      errors: error ? [{ message: error.message }] : null
    };
  };

  /**
   * Creates a delinquency detail object.
   * @param billingInformation The billing information data for the event.
   */
  static createDelinquencyEventDetail = (cancelDate, policyId, responsibleParty, entityId?) => {
    return {
      billingInformation: {
        cancelDate,
        responsibleParty
      },
      key: {
        tenantEntityId: Tenant.tenantEntityId || entityId,
        principalId: Tenant.principalId,
        policyId
      }
    };
  };

  /**
   * Creates a disbursement refund detail object.
   * @param billingInformation The billing information data for the event.
   */
  static createRefundEventDetail = (premiumRefund: PremiumRefund, invoiceNumber: string, policyId, entityId?) => {
    return {
      premiumRefund: premiumRefund,
      key: {
        tenantEntityId: Tenant.tenantEntityId || entityId,
        principalId: Tenant.principalId,
        invoiceNumber,
        policyId
      }
    };
  };

  /**
   * Creates a disbursement updated detail object.
   * @param disbursement The disbursement data for the event.
   */
  static createDisbursementUpdatedEventDetail = (disbursement: Disbursement) => {
    return {
      disbursement: disbursement,
      key: {
        policyId: disbursement.policyId,
        entityId: disbursement.entityId
      }
    };
  };

  /**
   * Creates a disbursement provider error detail object.
   * @param disbursement The disbursement data for the event.
   */
  static createDisbursementProviderErrorEventDetail = (disbursement: Disbursement) => {
    return {
      key: {
        referenceId: disbursement.referenceId,
        tenantEntityId: disbursement.entityId
      },
      errors: [{ message: `Provider error processing data: ${disbursement.rejectReason}` }]
    };
  };

  /**
   * Creates a disbursement created event detail
   * @param disbursement  Disbursement data for the event
   * @param policyId      Policy ID data for the event
   * @param paymentId     Payment ID data for the event
   */
  static createDisbursementCreatedEventDetail = (
    disbursement: DisbursementEventPayload,
    policyId: string,
    paymentId: string
  ): IDisbursementCreatedEvent => {
    const { referenceId } = disbursement;

    return {
      disbursement,
      key: {
        entityId: Tenant.tenantEntityId,
        tenantEntityId: Tenant.tenantEntityId,
        paymentId,
        policyId,
        referenceId
      }
    };
  };

  /**
   * Creates a disbursement edit event detail
   * @param disbursement  Disbursement data for the event
   * @param policyId      Policy ID data for the event
   * @param paymentId     Payment ID data for the event
   */
  static createDisbursementEditEventDetail = (
    disbursement: DisbursementEventPayload,
    isSuccess: boolean,
    policyId: string,
    paymentId: string
  ): IDisbursementCreatedEvent => {
    const { referenceId } = disbursement;

    return {
      disbursement,
      isSuccess,
      key: {
        entityId: Tenant.tenantEntityId,
        tenantEntityId: Tenant.tenantEntityId,
        paymentId,
        policyId,
        referenceId
      }
    };
  };

  /**
   * Creates a change disbursement state event detail
   * @param disbursement  Disbursement data for the event
   * @param policyId      Policy ID data for the event
   * @param paymentId     Payment ID data for the event
   */
  static createChangeDisbursementStateEventDetail = (
    disbursement: DisbursementEventPayload,
    policyId: string,
    paymentId: string
  ): IDisbursementStatusChangeEvent => {
    const { referenceId } = disbursement;

    return {
      disbursement,
      key: {
        entityId: Tenant.tenantEntityId,
        tenantEntityId: Tenant.tenantEntityId,
        paymentId,
        policyId,
        referenceId
      }
    };
  };

  /**
   * Creates the upload file payload for the event.
   * @param tenantEntityId
   * @param entityId
   * @param policyId
   * @param referenceId
   * @param payload
   * @param name
   */
  static createUploadFileEventData(
    tenantEntityId: string,
    entityId: string,
    policyId: string,
    referenceId: string,
    payload: string,
    name: string
  ): any {
    return {
      tenantEntityId: tenantEntityId,
      entityId: entityId,
      referenceId: referenceId,
      policyId: policyId,
      name: name,
      payload: payload,
      source: this.PayloadSourceTypes.Embedded,
      //documentTypeId: 0, // TODO: Update with document type when we get that defined
      metadata: {},
      key: {
        entityId,
        policyId,
        referenceId
      }
    };
  }

  /**
   * Creates the OutOfBalance event detail
   * @param policyId The policyId of the policy
   */
  static createOutOfBalanceDetail(policyId: string): any {
    return {
      policyId,
      key: {
        tenantEntityId: Tenant.tenantEntityId,
        policyId
      },
      queue: QueueType.OutOfBalance
    };
  }

  static createPaymentPlanChange(
    lastReinstatementDate: string,
    policyId: string,
    oldPaymentPlan: string,
    newPaymentPlan: string,
    responsibleParty: string
  ): any {
    return {
      key: {
        tenantEntityId: Tenant.tenantEntityId,
        policyId,
        principalId: Tenant.principalId
      },
      lastReinstatementDate,
      oldPaymentPlan,
      newPaymentPlan,
      responsibleParty
    };
  }
}
export namespace ServiceEventProducer {
  /**
   * Actions or events that are handled by a service listening on the event bus.
   */
  export enum DetailType {
    //Documents
    CreateDocument = 'CreateDocument',
    TransferDocument = 'TransferDocument',

    // Application
    ApplicationCreated = 'ApplicationCreated',
    ApplicationDocumentsResponse = 'ApplicationDocumentsResponse',
    ApplicationNotificationResponse = 'ApplicationNotificationResponse',

    // Policy Bind
    PolicyBound = 'PolicyBound',
    PolicyBoundDocumentResponse = 'PolicyBoundDocumentResponse',
    PolicyBoundNotification = 'PolicyBoundNotification',
    PolicyBoundNotificationResponse = 'PolicyBoundNotificationResponse',

    // Policy issue
    PolicyIssued = 'PolicyIssued',
    PolicyIssuedDocumentResponse = 'PolicyIssuedDocumentResponse',
    PolicyIssuedNotification = 'PolicyIssuedNotification',
    PolicyIssuedNotificationResponse = 'PolicyIssuedNotificationResponse',
    PolicyIssuedChangeMortgagee = 'PolicyIssuedChangeMortgagee',

    // Policy Canceled
    PolicyCanceled = 'PolicyCanceled',
    PolicyCanceledDocumentResponse = 'PolicyCanceledDocumentResponse',
    PolicyCanceledNotification = 'PolicyCanceledNotification',
    PolicyCanceledNotificationResponse = 'PolicyCanceledNotificationResponse',
    PolicyCanceledRefund = 'PolicyCanceledRefund',

    // Policy Balance Issues
    PolicyOutOfBalance = 'PolicyOutOfBalance',

    // Payment/receipt/statement
    StatementCreate = 'StatementCreate',
    PaymentReceived = 'PaymentReceived',
    PaymentReceivedDocumentsResponse = 'PaymentReceivedDocumentsResponse',
    PaymentReceivedNotification = 'PaymentReceivedNotification',
    PaymentReceivedNotificationResponse = 'PaymentReceivedNotificationResponse',
    PaymentFailureNotification = 'PaymentFailureNotification',
    PaymentPlanChange = 'PaymentPlanChange',

    // Payment Refund
    InitiatedRefund = 'InitiatedRefund',
    ProcessedRefund = 'ProcessedRefund',

    // Process payment for new balance due (mid term change payment)
    ProcessChangePayment = 'ProcessChangePayment',
    ProcessChangePaymentResponse = 'ProcessChangePaymentResponse',

    // Invoicing
    InvoiceCreate = 'InvoiceCreate',
    InvoiceDocumentCreated = 'InvoiceDocumentCreated',
    InvoiceNotification = 'InvoiceNotification',
    InvoiceNotificationComplete = 'InvoiceNotification',

    // Delinquency
    DelinquentPaymentNotice = 'DelinquentPaymentNotice',
    DelinquentPolicyNotice = 'DelinquentPolicyNotice',
    DelinquentPolicyCancel = 'DelinquentPolicyCancel',
    DelinquencyProcessAverted = 'DelinquencyProcessAverted',

    // Companion
    CompanionCanceled = 'CompanionCanceled',

    // Print Requested
    PrintRequested = 'PrintRequested',

    //Reinstatements
    Reinstatement = 'Reinstatement',
    PolicyReinstatement = 'PolicyReinstatement',

    // Disbursements
    DisbursementCreate = 'DisbursementCreate',
    DisbursementCreated = 'DisbursementCreated',
    DisbursementUpdated = 'DisbursementUpdated',
    ClaimDisbursementCreated = 'ClaimDisbursementCreated',
    ClaimDisbursementEditResponse = 'ClaimDisbursementEditResponse',
    ClaimDisbursementUpdated = 'ClaimDisbursementUpdated',
    ClaimDisbursementRequestEdit = 'ClaimDisbursementRequestEdit',
    ClaimDisbursementStateChanged = 'ClaimDisbursementStateChanged',
    PolicyDisbursementProviderError = 'PolicyDisbursementProviderError',
    ClaimDisbursementProviderError = 'ClaimDisbursementProviderError',
    RequestDisbursementAction = 'RequestDisbursementAction',
    TransferDocumentResponse = 'TransferDocumentResponse',

    // Reinstatement
    ReinstatementResponse = 'ReinstatementResponse',

    // Document
    DocumentUploadRequested = 'DocumentUploadRequested',
    RegenerateStatement = 'RegenerateStatement',

    //Error
    SystemError = 'SystemError'
  }

  /**
   * Source Types defining the different message sources.
   */
  export enum SourceType {
    PolicyService = 'api.policy',
    ClaimsService = 'api.claims',
    DocumentService = 'api.documents',
    NotificatonService = 'api.notification',
    PaymentService = 'api.payment'
  }

  /**
   * Payload source type for uploading content to the Document system
   */
  export enum PayloadSourceTypes {
    S3 = 'S3',
    Embedded = 'EMBEDDED'
  }
}
