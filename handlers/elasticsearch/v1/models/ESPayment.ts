import { parseESDateValue, parseESValue } from '../../../../libs/Utils';
import { LineItem } from '../../../accounting/v1/models/LineItem';
import { Payment } from '../../../accounting/v1/models/Payment';

/**
 * ESPayment
 */
export class ESPayment {
  key: string;
  entityId: string;
  agencyEntityIds: any;
  authCode: string;
  confirmationNumber: string;
  paymentType: string;
  provider: string;
  processedDate: string;
  subtotal: string;
  providerFee: string;
  subtotalPlusProviderFee: string;
  remainingBalance: string;
  writingCompany: string;
  status: string;

  constructor(record: Payment, ancestors: Array<string>, entityId: string) {
    this.key = parseESValue(record.policyNumber);
    this.entityId = parseESValue(entityId.replace(/-/g, ''));
    this.agencyEntityIds = ancestors || [];
    this.authCode = parseESValue(record.authCode);
    this.confirmationNumber = parseESValue(record.confirmationNumber);
    this.paymentType = parseESValue(record.paymentType);
    this.provider = parseESValue(record.provider);
    this.processedDate = parseESDateValue(record.processedDateTime);
    this.subtotal = parseESValue(record.subtotal);
    this.providerFee = parseESValue(record.providerFee);
    this.subtotalPlusProviderFee = parseESValue(record.subtotalPlusProviderFee);
    this.remainingBalance = parseESValue(record.remainingBalance);
    this.writingCompany = parseESValue(record.details[0]?.lineItems.find((item) => item.account === LineItem.AccountType.Main)?.writingCompany);
    this.status = parseESValue(record.status);
  }
}
