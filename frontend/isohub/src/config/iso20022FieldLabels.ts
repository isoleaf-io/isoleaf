/**
 * Human-readable labels for ISO 20022 technical field names.
 *
 * The Builder UI shows both: the friendly label on top so the user sees what
 * the field is for, and the technical name below in monospace so the
 * mapping back to the XML is visible. Keep keys identical to the XSD
 * element names — they're matched literally against `BuildFieldDto.name`.
 */
export const ISO20022_FIELD_LABELS: Record<string, string> = {
  // Group Header
  MsgId: "Message ID",
  CreDtTm: "Creation Date & Time",
  NbOfTxs: "Number of Transactions",
  CtrlSum: "Control Sum",
  InitgPty: "Initiating Party",

  // Settlement
  SttlmInf: "Settlement Information",
  SttlmMtd: "Settlement Method",
  SttlmAcct: "Settlement Account",
  ClrSys: "Clearing System",
  IntrBkSttlmAmt: "Interbank Settlement Amount",
  IntrBkSttlmDt: "Interbank Settlement Date",

  // Payment Identification
  PmtId: "Payment Identification",
  InstrId: "Instruction ID",
  EndToEndId: "End-to-End ID",
  TxId: "Transaction ID",
  UETR: "Unique Transaction Reference (UETR)",

  // Payment Type
  PmtTpInf: "Payment Type Information",
  SvcLvl: "Service Level",
  LclInstrm: "Local Instrument",
  CtgyPurp: "Category Purpose",

  // Parties
  Dbtr: "Debtor (Sender)",
  DbtrAcct: "Debtor Account",
  DbtrAgt: "Debtor Agent (Sender Bank)",
  Cdtr: "Creditor (Receiver)",
  CdtrAcct: "Creditor Account",
  CdtrAgt: "Creditor Agent (Receiver Bank)",
  UltmtDbtr: "Ultimate Debtor",
  UltmtCdtr: "Ultimate Creditor",
  InstgAgt: "Instructing Agent",
  InstdAgt: "Instructed Agent",
  IntrmyAgt1: "Intermediary Agent 1",
  IntrmyAgt2: "Intermediary Agent 2",

  // Party details
  Nm: "Name",
  PstlAdr: "Postal Address",
  Id: "Identification",
  FinInstnId: "Financial Institution ID",
  BICFI: "BIC (Bank Identifier Code)",
  IBAN: "IBAN",
  Othr: "Other ID",
  LEI: "Legal Entity Identifier (LEI)",

  // Amounts
  Amt: "Amount",
  InstdAmt: "Instructed Amount",
  EqvtAmt: "Equivalent Amount",
  XchgRate: "Exchange Rate",

  // Charges
  ChrgBr: "Charge Bearer",
  ChrgsInf: "Charges Information",

  // Remittance
  RmtInf: "Remittance Information",
  Ustrd: "Unstructured Remittance Info",
  Strd: "Structured Remittance Info",

  // Status (pacs.002)
  TxSts: "Transaction Status",
  StsRsnInf: "Status Reason Information",
  Rsn: "Reason",
  Cd: "Code",
  AddtlInf: "Additional Information",
  OrgnlGrpInfAndSts: "Original Group Information & Status",
  OrgnlMsgId: "Original Message ID",
  OrgnlMsgNmId: "Original Message Type",
  TxInfAndSts: "Transaction Information & Status",
  OrgnlEndToEndId: "Original End-to-End ID",
  OrgnlTxId: "Original Transaction ID",

  // Return (pacs.004)
  RtrRsnInf: "Return Reason Information",
  OrgnlTxRef: "Original Transaction Reference",

  // Statement (camt.053)
  Stmt: "Statement",
  FrToDt: "From/To Date",
  FrDtTm: "From Date & Time",
  ToDtTm: "To Date & Time",
  Acct: "Account",
  Bal: "Balance",
  Ntry: "Entry (Transaction)",
  CdtDbtInd: "Credit/Debit Indicator",
  BookgDt: "Booking Date",
  ValDt: "Value Date",
  BkTxCd: "Bank Transaction Code",
  NtryDtls: "Entry Details",
  TxDtls: "Transaction Details",
  Refs: "References",

  // pain.001
  CstmrCdtTrfInitn: "Customer Credit Transfer Initiation",
  PmtInf: "Payment Information",
  PmtMtd: "Payment Method",
  ReqdExctnDt: "Requested Execution Date",
  CdtTrfTxInf: "Credit Transfer Transaction Info",

  // Common
  GrpHdr: "Group Header",
  Dt: "Date",
  DtTm: "Date & Time",
  Tp: "Type",
  Prtry: "Proprietary",
  CdOrPrtry: "Code or Proprietary",
  AdrLine: "Address Line",
  TwnNm: "Town Name",
  Ctry: "Country",
  PstCd: "Postal Code",
};

export function getFieldLabel(technicalName: string): string {
  return ISO20022_FIELD_LABELS[technicalName] ?? technicalName;
}
