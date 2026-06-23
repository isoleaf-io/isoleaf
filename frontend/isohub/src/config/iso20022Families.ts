/**
 * Static dictionary of ISO 20022 message families. Drives the grouping in the
 * "Usado em" tab — names are taken from the official ISO 20022 catalogue so
 * the UI surfaces what implementers see in vendor docs.
 */
export interface Iso20022Family {
  /** Lowercase 4-letter prefix used in every messageType (e.g. <c>pacs</c>). */
  prefix: string;
  /** Full family name as defined by ISO 20022. */
  officialName: string;
  /** Short tag for narrow UI surfaces. */
  shortName: string;
}

export const ISO20022_FAMILIES: Iso20022Family[] = [
  {
    prefix: "pacs",
    officialName: "Payments Clearing and Settlement",
    shortName: "Payments C&S",
  },
  {
    prefix: "pain",
    officialName: "Payments Initiation",
    shortName: "Payments Init.",
  },
  {
    prefix: "camt",
    officialName: "Bank-to-Customer Cash Management",
    shortName: "Cash Management",
  },
  {
    prefix: "head",
    officialName: "Business Application Header",
    shortName: "App. Header",
  },
  {
    prefix: "acmt",
    officialName: "Account Management",
    shortName: "Acct. Mgmt.",
  },
];

export function getFamilyByPrefix(prefix: string): Iso20022Family | undefined {
  return ISO20022_FAMILIES.find((f) => f.prefix === prefix);
}

/** Extracts the 4-letter family prefix from a messageType. */
export function extractPrefix(messageType: string): string {
  return messageType.split(".")[0] ?? messageType;
}

/** Extracts the family+subId pair from a messageType. */
export function extractFamilyId(messageType: string): string {
  const parts = messageType.split(".");
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : messageType;
}

/** Extracts the variant+version tail (last two segments) from a messageType. */
export function extractVersion(messageType: string): string {
  const parts = messageType.split(".");
  return parts.length >= 4 ? `${parts[2]}.${parts[3]}` : messageType;
}
