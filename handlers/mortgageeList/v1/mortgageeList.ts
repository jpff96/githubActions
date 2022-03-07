import { buildResponse, resFailure } from '@eclipsetechnology/eclipse-api-helpers';

import * as mock from './providers/mock';

import { MortgageeListResultModel } from './models';

import { logError } from '../../../libs/logLib';

/**
 * Main entry point for Mortgage API.
 *
 * @param {object}   event      Event data.
 *
 * @return {object} Response object containing metadata or error message.
 */
export const main = async (event) => {
  let response = null;

  try {
    const mortgageeListResult = new MortgageeListResultModel();

    //switch (provider) {
    // TODO: Add providers as we get them - Note for a GET, provider needs to come in as a URL argument (can't be part of the body)
    //  default:
    await mock.mortgageeList(mortgageeListResult);
    //    break;
    //}

    response = buildResponse(mortgageeListResult.resultCode, null, mortgageeListResult);
  } catch (ex) {
    logError(console.log, ex, 'mortgageeList_ERROR');

    response = resFailure(event, { status: false, message: ex.message });
  }

  // Return a failed response if we reach this point in error
  if (response === null) {
    response = resFailure(event, {
      status: false,
      message: 'Unexpected error.'
    });
  }

  return response;
};
