/**
 * Build-time feature flags. Plain `as const` constants — no backend, no
 * runtime overrides. Flip an entry to `true` only when the feature is fully
 * implemented, tested and ready to ship. Tests can mock this module via
 * `vi.doMock` when they need a flag to be on.
 */

// Vite injects `import.meta.env.DEV` as a compile-time constant: `true` for
// the dev server (and Vitest, which runs in dev mode by default), `false`
// for production builds. The entire ISO 20022 module is gated on this until
// it ships — production users see no menu entry, no routes, no UI for it.
const isDev = import.meta.env.DEV;

// Type assertion via `satisfies` instead of `as const`: lets us combine
// literal `false` values with the runtime-conditional `isDev` boolean
// without TypeScript widening every entry to `boolean`.
const FLAGS = {
  // ISO 20022 — Sprint 6 (visível apenas em dev até o lançamento)
  iso20022: isDev,            // módulo ISO 20022 visível no menu
  iso20022Parser: isDev,      // 6.1 Parser XML ISO 20022
  iso20022FieldRef: isDev,    // 6.2 Referência de campos
  iso20022Validator: isDev,   // 6.3a Validador XSD
  iso20022Comparator: isDev,  // 6.3b Comparador de versões
  iso20022QrCode: false,      // 6.4 QR Code Pix (legacy slot — replaced by pixQrCode)
  iso20022Builder: isDev,     // 6.5 Builder de mensagens (dev-only até release)
  pixQrCode: isDev,           // 7.1 QR Code Pix — Brazilian Pix section (dev-only até release)
  pixFlowVisualizer: isDev,   // 7.3 Pix Flow Visualizer (multi-message sequence)
  iso20022Txid: false,        // 6.6 TXID + Chaves DICT
  iso20022MtMx: false,        // 6.7 MT → MX Comparador
  swiftMtParser: isDev,       // 9.1 SWIFT MT103/MT202/MT202COV parser (dev-only)
  swiftMtComparator: isDev,   // 9.2 SWIFT MT↔MX comparator/converter (dev-only)
  swiftFlowVisualizer: isDev, // 9.3 CBPR+ MX + MT tabs inside FlowVisualizer
};

export const FEATURES: Readonly<typeof FLAGS> = FLAGS;

export type FeatureKey = keyof typeof FLAGS;
