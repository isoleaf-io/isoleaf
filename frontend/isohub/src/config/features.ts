/**
 * Build-time feature flags. Plain literals — no backend, no runtime overrides.
 * Every shipped ISOLeaf 2.0 feature is `true` here; the handful of `false`
 * entries are legacy slots that were replaced by newer flags and stay off
 * to keep the routing table pinned (never delete a flag key without
 * grepping every consumer first). Tests can mock this module via
 * `vi.doMock` when they need to force a specific flag value.
 */
const FLAGS = {
  // ISO 20022 module — shipped in ISOLeaf 2.0.
  iso20022: true,             // ISO 20022 module visible in the menu
  iso20022Parser: true,       // 6.1 XML Parser
  iso20022FieldRef: true,     // 6.2 Field Reference
  iso20022Validator: true,    // 6.3a XSD Validator
  iso20022Comparator: true,   // 6.3b Version Comparator
  iso20022QrCode: false,      // 6.4 Pix QR Code (legacy slot — replaced by pixQrCode)
  iso20022Builder: true,      // 6.5 Message Builder
  pixQrCode: true,            // 7.1 Pix QR Code — Brazilian Pix section
  pixFlowVisualizer: true,    // 7.3 Pix Flow Visualizer (multi-message sequence)
  iso20022Txid: false,        // 6.6 TXID + DICT keys (legacy slot, not shipped)
  iso20022MtMx: false,        // 6.7 MT → MX Comparator (legacy slot — replaced by swiftMtComparator)
  swiftMtParser: true,        // 9.1 SWIFT MT103/MT202/MT202COV parser
  swiftMtComparator: true,    // 9.2 SWIFT MT↔MX comparator/converter
  swiftFlowVisualizer: true,  // 9.3 CBPR+ MX + MT tabs inside FlowVisualizer
  iso8583FlowVisualizer: true, // 9.4 ISO 8583 card-payment flows tab
};

export const FEATURES: Readonly<typeof FLAGS> = FLAGS;

export type FeatureKey = keyof typeof FLAGS;
