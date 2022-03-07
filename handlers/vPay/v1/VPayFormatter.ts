import { safeTrim } from '@eclipsetechnology/eclipse-api-helpers';
import { ProductAccounting } from '@eclipsetechnology/product-library/dist/models';

import { VPayReference } from './models/VPayReference';
import { VPayHeader } from './models/VPayHeader';
import { VPayParty } from './models/VPayParty';
import { VPayPayment } from './models/VPayPayment';
import { VPayTrailer } from './models/VPayTrailer';
import { Disbursement } from '../../disbursement/v1/models';

import { VPayPaddingConfig } from '../../../libs/constLib';
import { CostType } from '../../../libs/enumLib';

import {
  GovernmentIdNumber,
  GovernmentIdType,
  LocaleType,
  RecipientPartyType,
  TimeZoneType,
  VPayBooleanType,
  VPayPartyType,
  VPayRecordType,
  VPayRemitMethodType
} from '../../../libs/enumLib';

import { camelCaseToHumanCase } from '../../../libs/stringLib';

interface IFormatFieldOptions {
  padding?: boolean,
  paddingMax?: number,
  paddingSymbol?: string,
  slice?: number
}

interface IMappedDisbursements {
  mappedPayments: Array<VPayPayment>,
  mappedParties: Array<VPayParty>,
  mappedReferences: Array<VPayReference>
  mappedDocuments: Array<IMappedDocuments>
}

interface IMappedDocuments {
  description?: string,
  fileName: string,
  key: string
}

interface IVpayFormatResult {
  manifestFileContent: string,
  mappedDocuments: Array<IMappedDocuments>
}

export class VPayFormatter {
  static CRLF = '\r\n';

  static partyTypeMapper = {
    [RecipientPartyType.Business]: VPayPartyType.Business,
    [RecipientPartyType.Consumer]: VPayPartyType.Consumer
  };

  /**
   * Create a .txt file and a list of document data to be bundle to VPay
   *
   * @param disbursements
   * @param fileDateTime
   */
  static mapDisbursementToVpayFormat = (
    disbursements: Array<Disbursement>,
    fileDateTime: Date
  ): IVpayFormatResult => {
    // Map disbursement data to be used here
    const parsedFileDateTime = VPayFormatter.parseDate(fileDateTime);
    const header = new VPayHeader({ fileDateTime: parsedFileDateTime });
    const mappedDisbursements = VPayFormatter.mapDisbursements(disbursements, parsedFileDateTime);
    const trailerList = VPayFormatter.mapTrailers(mappedDisbursements);

    // Map data into text format
    const { mappedPayments, mappedParties, mappedReferences, mappedDocuments } = mappedDisbursements;

    const headerText = VPayFormatter.mapHeaderToText(header);
    const paymentText = VPayFormatter.mapPaymentsToText(mappedPayments);
    const partyText = VPayFormatter.mapPartiesToText(mappedParties);
    const referenceText = VPayFormatter.mapReferencesToText(mappedReferences);
    const trailerText = VPayFormatter.mapTrailersToText(trailerList);

    const manifestFileContent = headerText + paymentText + partyText + referenceText + trailerText;

    return { manifestFileContent, mappedDocuments };
  };

  /**
   * Format the string for an item
   *
   * @param item
   * @param options
   */
  static formatField = (item, options: IFormatFieldOptions = {}) => {
    let strItem = item;

    const {
      padding,
      paddingMax = VPayPaddingConfig.PADDING_MAX,
      paddingSymbol = '0',
      slice
    } = options;

    if (typeof item === 'number') {
      strItem = item.toString();
    }

    strItem = safeTrim(strItem).toUpperCase();

    if (padding) {
      strItem = strItem.padStart(paddingMax, paddingSymbol);
    }

    // TODO: This is a workaround for VPay issues on the max length, must find a better solution.
    if (slice) {
      strItem = strItem.slice(0, slice);
    }

    return strItem;
  };

  /**
   * Maps a set of Disbursement objects into VPayPayment, VPayParty and VPayReference objects
   * 
   * @param disbursementsList
   * @param fileDateTime
   */
  static mapDisbursements = (
    disbursementsList: Array<Disbursement>,
    fileDateTime: string
  ): IMappedDisbursements => {
    const mappedPayments: Array<VPayPayment> = [];
    const mappedParties: Array<VPayParty> = [];
    const mappedReferences: Array<VPayReference> = [];
    const mappedDocuments: Array<IMappedDocuments> = [];

    for (const disbursements of disbursementsList) {
      const {
        pk: disbursementId,
        amount,
        catastropheType,
        costType,
        coverage,
        createdDateTime,
        documentKeyList,
        lossDateTime,
        mailingAddress,
        memo,
        payerIdOrFundingAccountCode,
        paymentType,
        policyNumber,
        productKey,
        reason,
        recipients,
        referenceNumber,
        shippingCompanyName,
        shippingEmail,
        shippingFirstName,
        shippingLastName
      } = disbursements;

      const partyCount = recipients.length;
      const { city, line1, line2, postalCode, state } = mailingAddress;
      const parsedLossDateTime = lossDateTime && VPayFormatter.parseDate(new Date(lossDateTime));
      const numberOfAttachedPdfFiles = documentKeyList.length;
      const remitMethod = numberOfAttachedPdfFiles > 0 ? VPayRemitMethodType.Pdf : VPayRemitMethodType.None;

      let shippingName;

      if (shippingCompanyName) {
        shippingName = shippingCompanyName;
      } else {
        shippingName = `${shippingFirstName} ${shippingLastName}`;
      }

      // Map payments
      mappedPayments.push(new VPayPayment({
        paymentId: disbursementId,
        clientReferenceId: referenceNumber,
        payerIdOrFundingAccountCode,
        payerDateTime: VPayFormatter.parseDate(new Date(createdDateTime)),
        paymentAmount: amount,
        remitMethod,
        partyCount,
        shippingName,
        shippingAddress1: line1,
        shippingAddress2: line2,
        shippingCity: city,
        shippingStateOrProvince: state,
        shippingPostalCode: postalCode,
        numberOfAttachedPdfFiles
      }));

      // Map references
      mappedReferences.push(new VPayReference({
        paymentId: disbursementId,
        referenceNumber,
        policyNumber,
        coverage: camelCaseToHumanCase(coverage),
        memo,
        paymentType: camelCaseToHumanCase(paymentType),
        lossDateTime: parsedLossDateTime,
        reason
      }));

      // Map recipients
      let hasDefaultAddressSet = false;

      for (const recipient of recipients) {
        const {
          address,
          companyName,
          email,
          firstName,
          governmentIdNumber,
          lastName,
          partyType,
          isDefaultRecipient
        } = recipient;
        const { city, line1, line2, postalCode, state } = address;
        const mappedPartyType = VPayFormatter.partyTypeMapper[partyType];

        let defaultAddress = VPayBooleanType.No;
        let partyName = '';
        let mappedGovernmentIdNumber = '';
        let mappedGovernmentIdType = '';

        if (!hasDefaultAddressSet && isDefaultRecipient) {
          defaultAddress = VPayBooleanType.Yes;
          hasDefaultAddressSet = true;
        }

        if (companyName) {
          partyName = companyName;
        } else {
          partyName = `${firstName} ${lastName}`;
        }

        if (mappedPartyType === VPayPartyType.Business) {
          mappedGovernmentIdNumber = governmentIdNumber ?? GovernmentIdNumber.DummyNumber;
          mappedGovernmentIdType = GovernmentIdType.TIN;
        }

        mappedParties.push(new VPayParty({
          defaultAddress,
          paymentId: disbursementId,
          partyType: mappedPartyType,
          partyName,
          partyAddress1: line1,
          partyAddress2: line2,
          partyCity: city,
          partyStateOrProvince: state,
          partyPostalCode: postalCode,
          governmentIdNumber: mappedGovernmentIdNumber,
          governmentIdType: mappedGovernmentIdType
        }));
      }

      // Map documents
      for (const [i, documentKey] of documentKeyList.entries()) {
        mappedDocuments.push({
          key: documentKey,
          fileName: `${disbursementId}_${fileDateTime}_${i + 1}.pdf`
        });
      }

      // If "hasDefaultAddressSet" wasn't set, default to the first payee
      if (!hasDefaultAddressSet) {
        mappedParties[0].defaultAddress = VPayBooleanType.Yes;
      }
    }

    return { mappedPayments, mappedParties, mappedReferences, mappedDocuments };
  };

  /**
   * Creates the set of VPayTrailer objects
   * @param mappedDisbursements
   */
  static mapTrailers = (mappedDisbursements: IMappedDisbursements): Array<VPayTrailer> => {
    const { mappedPayments, mappedParties, mappedReferences } = mappedDisbursements;
    const referencesCount = mappedReferences.length;
    const partiesCount = mappedParties.length;
    const paymentsCount = mappedPayments.length;
    const totalCount = referencesCount + partiesCount + paymentsCount + 6; // 6 = 1 Header + 5 Trailers

    const mappedTrailers = [
      new VPayTrailer({
        referenceRecordType: VPayRecordType.Header,
        referenceRecordCount: VPayFormatter.formatField(1, { padding: true }),
        trailerRecordNumber: VPayFormatter.formatField(1, { padding: true })
      }),
      new VPayTrailer({
        referenceRecordType: VPayRecordType.Payment,
        referenceRecordCount: VPayFormatter.formatField(paymentsCount, { padding: true }),
        trailerRecordNumber: VPayFormatter.formatField(2, { padding: true })
      }),
      new VPayTrailer({
        referenceRecordType: VPayRecordType.Party,
        referenceRecordCount: VPayFormatter.formatField(partiesCount, { padding: true }),
        trailerRecordNumber: VPayFormatter.formatField(3, { padding: true })
      }),
      new VPayTrailer({
        referenceRecordType: VPayRecordType.Reference,
        referenceRecordCount: VPayFormatter.formatField(referencesCount, { padding: true }),
        trailerRecordNumber: VPayFormatter.formatField(4, { padding: true })
      }),
      new VPayTrailer({
        referenceRecordType: VPayRecordType.Trailer,
        referenceRecordCount: VPayFormatter.formatField(totalCount, { padding: true }),
        trailerRecordNumber: VPayFormatter.formatField(5, { padding: true })
      })
    ];

    return mappedTrailers;
  };

  /**
   * Converts a header info into a text line for VPay
   * @param headerInfo
   */
  static mapHeaderToText = (headerInfo: VPayHeader): string => {
    const { recordType, origin, tpa, recordNumber, fileDateTime, version } = headerInfo;

    const headerArray = [
      VPayFormatter.formatField(recordType),
      VPayFormatter.formatField(origin),
      VPayFormatter.formatField(tpa),
      VPayFormatter.formatField(recordNumber),
      VPayFormatter.formatField(fileDateTime),
      VPayFormatter.formatField(version),
      '', // Blank field
      '', // Blank field
      VPayFormatter.CRLF
    ];

    return headerArray.join('|');
  };

  /**
   * Converts a set of reference objects info into a text line for VPay
   * @param referenceList
   */
  static mapReferencesToText = (referenceList: Array<VPayReference>): string => {
    const referenceTextList = [];

    for (const reference of referenceList) {
      const {
        recordType,
        paymentId,
        referenceNumber,
        memberName,
        policyNumber,
        coverage,
        memo,
        paymentType,
        lossDateTime,
        adjuster,
        reason
      } = reference;

      const referenceArray = [
        VPayFormatter.formatField(recordType),
        VPayFormatter.formatField(paymentId),
        VPayFormatter.formatField(referenceNumber),
        VPayFormatter.formatField(memberName, { slice: 30 }),
        VPayFormatter.formatField(policyNumber),
        VPayFormatter.formatField(coverage),
        VPayFormatter.formatField(memo),
        VPayFormatter.formatField(paymentType),
        VPayFormatter.formatField(lossDateTime),
        VPayFormatter.formatField(adjuster, { slice: 100 }),
        VPayFormatter.formatField(reason, { slice: 64 }),
        VPayFormatter.CRLF
      ];

      referenceTextList.push(referenceArray.join('|'));
    }

    return referenceTextList.join('');
  };

  /**
   * Converts a set of party info into a text line for VPay
   * @param partyList
   */
  static mapPartiesToText = (partyList: Array<VPayParty>): string => {
    const partyTextList = [];

    for (const party of partyList) {
      const {
        recordType,
        paymentId,
        partyType,
        paymentRequestType,
        endorser,
        payee,
        partyName,
        defaultAddress,
        partyAddress1,
        partyAddress2,
        partyAddress3,
        partyCity,
        partyStateOrProvince,
        partyCountry,
        partyPostalCode,
        governmentIdNumber,
        governmentIdType,
        preferredDocDistributionMethod,
        preferredContactMethod
      } = party;

      const partyArray = [
        VPayFormatter.formatField(recordType),
        VPayFormatter.formatField(paymentId),
        '', // Blank field
        '', // Blank field
        '', // Blank field
        '', // Blank field
        '', // Blank field
        '', // Blank field
        VPayFormatter.formatField(partyType),
        VPayFormatter.formatField(paymentRequestType),
        VPayFormatter.formatField(endorser),
        VPayFormatter.formatField(payee),
        VPayFormatter.formatField(partyName, { slice: 100 }),
        VPayFormatter.formatField(defaultAddress),
        VPayFormatter.formatField(partyAddress1, { slice: 40 }),
        VPayFormatter.formatField(partyAddress2, { slice: 40 }),
        VPayFormatter.formatField(partyAddress3, { slice: 40 }),
        VPayFormatter.formatField(partyCity, { slice: 50 }),
        VPayFormatter.formatField(partyStateOrProvince, { slice: 3 }),
        VPayFormatter.formatField(partyCountry, { slice: 3 }),
        VPayFormatter.formatField(partyPostalCode, { slice: 15, padding: true, paddingMax: 5 }),
        '', // Blank field
        '', // Blank field
        '', // Blank field
        '', // Blank field
        '', // Blank field
        '', // Blank field
        VPayFormatter.formatField(governmentIdNumber),
        VPayFormatter.formatField(governmentIdType),
        '', // Blank field
        '', // Blank field
        VPayFormatter.formatField(preferredDocDistributionMethod),
        VPayFormatter.formatField(preferredContactMethod),
        VPayFormatter.CRLF
      ];

      partyTextList.push(partyArray.join('|'));
    }

    return partyTextList.join('');
  };

  /**
   * Converts a set of payment info into a text line for VPay
   * @param paymentList
   */
  static mapPaymentsToText = (paymentList: Array<VPayPayment>): string => {
    const paymentTextList = [];

    for (const payment of paymentList) {
      const {
        recordType,
        paymentId,
        clientReferenceId,
        payerIdOrFundingAccountCode,
        payerDateTime,
        paymentAmount,
        paymentCurrency,
        remitMethod,
        partyCount,
        timeoutOutcome,
        partiesDisagree,
        mepEligible,
        shippingName,
        shippingAddress1,
        shippingAddress2,
        shippingAddress3,
        shippingCity,
        shippingStateOrProvince,
        shippingCountry,
        shippingPostalCode,
        numberOfAttachedPdfFiles
      } = payment;

      const paymentArray = [
        VPayFormatter.formatField(recordType),
        VPayFormatter.formatField(paymentId),
        VPayFormatter.formatField(clientReferenceId),
        VPayFormatter.formatField(payerIdOrFundingAccountCode),
        VPayFormatter.formatField(payerDateTime),
        VPayFormatter.formatField(paymentAmount),
        VPayFormatter.formatField(paymentCurrency),
        VPayFormatter.formatField(remitMethod),
        VPayFormatter.formatField(partyCount),
        '', // Blank field
        VPayFormatter.formatField(timeoutOutcome),
        VPayFormatter.formatField(partiesDisagree),
        '', // Blank field
        VPayFormatter.formatField(mepEligible),
        VPayFormatter.formatField(shippingName, { slice: 100 }),
        VPayFormatter.formatField(shippingAddress1, { slice: 40 }),
        VPayFormatter.formatField(shippingAddress2, { slice: 40 }),
        VPayFormatter.formatField(shippingAddress3, { slice: 40 }),
        VPayFormatter.formatField(shippingCity, { slice: 50 }),
        VPayFormatter.formatField(shippingStateOrProvince, { slice: 3 }),
        VPayFormatter.formatField(shippingCountry, { slice: 3 }),
        VPayFormatter.formatField(shippingPostalCode, { slice: 15, padding: true, paddingMax: 5 }),
        VPayFormatter.formatField(numberOfAttachedPdfFiles),
        VPayFormatter.CRLF
      ];

      paymentTextList.push(paymentArray.join('|'));
    }

    return paymentTextList.join('');
  };

  /**
   * Converts a set of trailer info into a text line for VPay
   * @param trailerList
   */
  static mapTrailersToText = (trailerList: Array<VPayTrailer>): string => {
    const trailerTextList = [];

    for (const trailer of trailerList) {
      const { recordType, referenceRecordType, trailerRecordNumber, referenceRecordCount } = trailer;

      const trailerArray = [
        VPayFormatter.formatField(recordType),
        VPayFormatter.formatField(referenceRecordType),
        VPayFormatter.formatField(trailerRecordNumber),
        VPayFormatter.formatField(referenceRecordCount),
        '', // Blank field
        VPayFormatter.CRLF
      ];

      trailerTextList.push(trailerArray.join('|'));
    }

    return trailerTextList.join('');
  };

  /**
   * Parses a date to the VPay expected format
   * @param dateTime
   */
  static parseDate = (dateTime: Date): string => {
    const dateObject = new Date(dateTime);
    const timeZone = TimeZoneType.AmericaNewYork;
    const locale = LocaleType.En_u_hc_h23;

    const year = new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric' }).format(dateObject);
    const month = new Intl.DateTimeFormat(locale, { timeZone, month: '2-digit' }).format(dateObject);
    const day = new Intl.DateTimeFormat(locale, { timeZone, day: '2-digit' }).format(dateObject);
    const hours = new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', hour12: false }).format(dateObject);
    const minutes = new Intl.DateTimeFormat(locale, { timeZone, minute: '2-digit' }).format(dateObject).padStart(2, '0');
    const seconds = new Intl.DateTimeFormat(locale, { timeZone, second: '2-digit' }).format(dateObject).padStart(2, '0');
    const milliseconds = dateObject.getMilliseconds().toString().padStart(3, '0').padEnd(6, '0');

    return `${year}-${month}-${day}-${hours}.${minutes}.${seconds}.${milliseconds}`;
  };
}
