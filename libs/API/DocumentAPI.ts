const axios = require('axios');

export class DocumentAPI {
  /**
   * Call the document queue API to create a document
   *
   * @param rootHref
   * @param origin
   * @param Authorization
   * @param prefix
   * @param docData
   */
  static createDocument = async (rootHref: string, origin: string, Authorization: string, prefix: string, docData: Object): Promise<string> => {
    const request = await axios({
      method: 'post',
      url: `${rootHref}${prefix}/queue/v1/jobs/create`,
      headers: {
        origin,
        'content-type': 'application/json',
        Authorization
      },
      data: JSON.stringify(docData)
    });

    return request.data.data.token;
  };
}
