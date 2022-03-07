import { EntityMain } from '@eclipsetechnology/entity-library/dist/models/entity2';
import { Request } from 'express';

/**
 * Tenant
 */
export default class Tenant {
  static isConsumer = false;
  static tenantEntityId: string = '';
  static principalId: string = '';
  static email: string = '';
  static headers: any;

  /**
   * Initializes the tenant instance from event data.
   * @param request The lambda event.
   */
  static init(request: Request) {
    const auth = request['requestContext']?.authorizer;

    if (auth) {
      this.tenantEntityId = auth.tenantId;
      this.principalId = auth.principalId;
      this.email = auth.email;
      this.headers = request.headers;

      if (auth['isConsumer'] === 'true') {
        this.isConsumer = true;
      } else {
        this.isConsumer = false;
      }
    }
  }

  /**
   * Intializes the tenant instances from data of a eventbus event
   *
   * @static
   * @param key The EventBus event key containing tenant and principal information.
   * @memberof Tenant
   */
  static initFromEvent(key: any) {
    this.tenantEntityId = key?.entityId;
  }

  /**
   * Centralized logic to test if a specified entity is in the correct tenant
   *
   * @param entity
   * @param tenantKey
   */
  static isEntityInTenant(entity: EntityMain, tenantKey: string): boolean {
    let isInTenant: boolean = false;

    const { entity: entityKey, ancestors } = entity;

    if (tenantKey === entityKey) {
      isInTenant = true;
    } else if (ancestors) {
      isInTenant = ancestors.includes(tenantKey);
    }

    return isInTenant;
  }
}
