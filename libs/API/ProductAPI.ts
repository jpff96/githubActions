import * as prodLib from '@eclipsetechnology/product-library';
import { ProductAccounting, ProductMain, ProductPolicy } from '@eclipsetechnology/product-library/dist/models';
import { ProductRecordType } from '@eclipsetechnology/product-library/dist/utils/enumLib';
import { ConfigurationError } from '../errors/ConfigurationError';
import { ErrorCodes } from '../errors/ErrorCodes';

prodLib.config({
  awsRegion: process.env.AWS_SERVICE_REGION,
  productTable: process.env.PRODUCT_TABLE_NAME
});

export class ProductAPI {
  /**
   * Gets the list of products for an entity.
   * @param entity The entity id.
   */
  static getProductList = async (): Promise<Array<string>> => {
    try {
      const entityId = '00000000-0000-0000-0000-000000000000';

      const products = await prodLib.listProducts(entityId);

      return products;
    } catch (err) {
      console.error(err);

      throw new ConfigurationError(ErrorCodes.ProductRequestFailed, 'Unable to get product list.');
    }
  };

  /**
   * Gets the configuration information from the product library.
   * @param productKey The product to get.
   */
  static getConfiguration = async (productKey: string): Promise<[ProductMain, ProductAccounting]> => {
    try {
      let accountingConfig: ProductAccounting;
      let mainConfig: ProductMain;

      const productConfig = await prodLib.getProduct(productKey, [
        ProductRecordType.MAIN,
        ProductRecordType.ACCOUNTING
      ]);

      for (const config of productConfig) {
        if (config instanceof ProductAccounting) {
          accountingConfig = config;
        } else if (config instanceof ProductMain) {
          mainConfig = config;
        }
      }

      return [mainConfig, accountingConfig];
    } catch (err) {
      console.error(err);

      throw new ConfigurationError(ErrorCodes.ProductRequestFailed, 'Unable to get configuration');
    }
  };
}
