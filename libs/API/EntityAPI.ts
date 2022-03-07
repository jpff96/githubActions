import * as EntityLib from '@eclipsetechnology/entity-library';
import { EntityMain } from '@eclipsetechnology/entity-library/dist/models/entity2';

EntityLib.config({
  awsRegion: process.env.AWS_SERVICE_REGION,
  entityTable: process.env.ENTITY_TABLE_NAME
});

export class EntityAPI {
  static ServiceKey = {
    Payment: 'Solstice-Payment-API',
    Notification: 'Solstice-Notifications-API'
  };

  /**
   * Lookup the specified entity from the entity api
   *
   * @param entityId
   */
  static getEntity = async (entityId: string): Promise<EntityMain> => {
    return await EntityLib.getEntity2(entityId, false);
  };

  /**
   * Lookup the effective API configuration
   *
   * @param entityId
   * @param serviceKey
   */
  static getApiConfig = async (entityId: string, serviceKey: string) => {
    return await EntityLib.getApiConfig2(entityId, serviceKey);
  };

  /**
   * List API configuration records for specified service
   *
   * @param serviceKey
   */
  static listApiConfig = async (serviceKey: string) => {
    return await EntityLib.listApiConfig(serviceKey);
  };

  /**
   * Gets the entities ancestor list.
   * 
   * @param entityId The entity id.
   */
  static getAncestors = async (entityId: string): Promise<Array<string>> => {
    const ancestors = (await EntityLib.getEntity2(entityId, false))?.ancestors;
    ancestors.push(entityId);

    return ancestors;
  };
}
