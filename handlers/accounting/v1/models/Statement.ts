// TODO: this class could inherit from handlers/accounting/v1/models/GenericBilling.ts

export class Statement {
  // Exclusive for mortgagee payment plans
  companyName: string;
  // To send emails to the mortgagee company
  companyEmail: string;
  loanNumber: string;

  policyId: string;
  dueDate: string;
  nextBillDate: string;
  scanline: string;
  paymentPlan: string;
  responsibleParty: string;
  installmentNumber: number;
  installmentRemaining: number;
  invoiceNumber: string;
  amountDue: number;
  amountReceived: number;
  amountRemaining: number;

  createdDateTime: string;

  constructor(data?: any) {
    if (data) {
      this.policyId = data.policyId;
      this.companyName = data.companyName;
      this.loanNumber = data.loanNumber;
      this.companyEmail = data.companyEmail;
      this.invoiceNumber = data.invoiceNumber;
      this.amountDue = data.amountDue;
      this.dueDate = data.dueDate;
      this.scanline = data.scanline;
      this.amountReceived = data.amountReceived;
      this.amountRemaining = data.amountRemaining;
      this.createdDateTime = data.createdDateTime || new Date().toISOString();
    }
  }
}
