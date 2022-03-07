import { MortgageeModel } from '.';

/**
 * Model to contain results of looking up available mortgagee companies
 */
export class MortgageeListResultModel {
  provider: string = '';
  resultCode: number = 200;
  resultMessage: string = '';

  response: MortgageeModel[] = [];

  constructor() {}
}
