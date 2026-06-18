/**
 * Build-time feature flags. Plain `as const` constants — no backend, no
 * runtime overrides. Flip an entry to `true` only when the feature is fully
 * implemented, tested and ready to ship. Tests can mock this module via
 * `vi.doMock` when they need a flag to be on.
 */
export const FEATURES = {
  // ISO 20022 — Sprint 6
  // Habilitar cada flag quando a feature estiver completa e pronta para produção
  iso20022: false,           // módulo ISO 20022 visível no menu
  iso20022Parser: false,     // 6.1 Parser XML ISO 20022
  iso20022FieldRef: false,   // 6.2 Referência de campos
  iso20022Validator: false,  // 6.3 Validador de schema XSD
  iso20022QrCode: false,     // 6.4 QR Code Pix
  iso20022Builder: false,    // 6.5 Builder de mensagens
  iso20022Txid: false,       // 6.6 TXID + Chaves DICT
  iso20022MtMx: false,       // 6.7 MT → MX Comparador
} as const;

export type FeatureKey = keyof typeof FEATURES;
