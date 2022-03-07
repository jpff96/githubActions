import * as AWS from 'aws-sdk';
import ActivityLogError from '../models/ActivityLogError';
import { ErrorCodes } from '../models/ErrorCodes';
import Tenant from './Tenant';

AWS.config.update({ region: process.env.AWS_SERVICE_REGION });

/**
 * Activity Log Producer
 */
export class ActivityLogProducer {
  private static eventBridge = new AWS.EventBridge();
  /**
   * Detail Types defining data structure in the detail property.
   */
  static DetailTypes = {
    ActivityLog: 'ActivityLog'
  };

  /**
   * Id Types defining data structure in the detail property.
   */
  static IdTypes = {
    Policy: 'Policy'
  };

  /**
   * Source Types defining the different message sources.
   */
  static SourceTypes = {
    PolicyService: 'api.policy',
    ClaimsService: 'api.claims',
    CommandCenter: 'client.commandCenter',
    PaymentService: 'api.payment'
  };

  static Source = ActivityLogProducer.SourceTypes.PolicyService;
  static DetailType = ActivityLogProducer.DetailTypes.ActivityLog;

  /**
   * Creates an activity log object.
   * @param policyId The policy Id the activity belongs to.
   * @param agencyEntityId The agency entity Id the policy belongs to.
   * @param template The template of the activity log.
   * @param properties The property values to replace in the template.
   */
  static createActivityLog = (policyId: string, agencyEntityId: string, template: string, properties: any = {}) => {
    return {
      policyId: policyId,
      agencyEntityId: agencyEntityId,
      idType: ActivityLogProducer.IdTypes.Policy,
      template: template,
      properties: properties,
      userKey: Tenant.email || 'System',
      detailDateTime: new Date().toISOString()
    };
  };

  /**
   * Sends an activity log to the event bus for processing.
   * @param policyId The policy Id the activity belongs to.
   * @param agencyEntityId The agency entity Id the policy belongs to.
   * @param template The template of the activity log.
   * @param properties The property values to replace in the template.
   */
  static sendActivityLog = async (policyId: string, agencyEntityId: string, template: string, properties: any = {}) => {
    try {
      const activityLog = ActivityLogProducer.createActivityLog(policyId, agencyEntityId, template, properties);
      const params = {
        Entries: [
          {
            Detail: JSON.stringify(activityLog),
            DetailType: ActivityLogProducer.DetailTypes.ActivityLog,
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: ActivityLogProducer.SourceTypes.PaymentService
          }
        ]
      };

      await ActivityLogProducer.eventBridge.putEvents(params).promise();
    } catch (ex) {
      console.error(ex);

      throw new ActivityLogError(
        `Failed to send activity log to the event bus. ${ex.message}`,
        ErrorCodes.ACTIVITY_LOG_SEND_FAIL
      );
    }
  };

  /**
   * Sends activity logs to the event bus for processing.
   * @param activityLogs Array of activity logs.
   */
  static sendActivityLogs = async (activityLogs: Array<any>) => {
    try {
      const params = {
        Entries: []
      };

      activityLogs.forEach((log) => {
        params.Entries.push({
          Detail: JSON.stringify(log),
          DetailType: ActivityLogProducer.DetailTypes.ActivityLog,
          EventBusName: process.env.EVENT_BUS_NAME,
          Source: ActivityLogProducer.SourceTypes.PaymentService
        });
      });

      await ActivityLogProducer.eventBridge.putEvents(params).promise();
    } catch (ex) {
      console.error(ex);

      throw new ActivityLogError(
        `Failed to send activity log to the event bus. ${ex.message}`,
        ErrorCodes.ACTIVITY_LOG_SEND_FAIL
      );
    }
  };
}
