import { MortgageeModel, MortgageeListResultModel } from '../models';
import { MortgageeListProviderType } from '../../../../libs/constLib';

/**
 * Mock provider mortgagee list. For test purposes only
 *
 * @param {object} mortgageeListResult The result payload to be returned to the caller
 *
 * @return {object} None. This method acts on the mortgageeListResult object.
 */
export const mortgageeList = async (mortgageeListResult: MortgageeListResultModel) => {
  mortgageeListResult.provider = MortgageeListProviderType.MOCK;

  mortgageeListResult.response.push(
    new MortgageeModel({
      name: 'Mortgage Company 1',
      loanNumber: '100001',
      street: 'An example street #111',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001'
    })
  );

  mortgageeListResult.response.push(
    new MortgageeModel({
      name: 'Mortgage Company 2',
      loanNumber: '100002',
      street: 'An example street #112',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90002'
    })
  );

  mortgageeListResult.response.push(
    new MortgageeModel({
      name: 'Mortgage Company 3',
      loanNumber: '100003',
      street: 'An example street #113',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90003'
    })
  );

  mortgageeListResult.response.push(
    new MortgageeModel({
      name: 'Mortgage Company 4',
      loanNumber: '100004',
      street: 'An example street #114',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90004'
    })
  );

  mortgageeListResult.response.push(
    new MortgageeModel({
      name: 'Mortgage Company 5',
      loanNumber: '100005',
      street: 'An example street #115',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90005'
    })
  );

  // Result
  mortgageeListResult.resultCode = 200;
  mortgageeListResult.resultMessage = 'success';
};
