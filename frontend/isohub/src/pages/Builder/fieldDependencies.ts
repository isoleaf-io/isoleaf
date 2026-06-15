/**
 * Static dependency graph between ISO 8583 bits.
 * When a parent bit is edited, every dependent gets marked `stale` so the user
 * can decide whether to regenerate, keep or edit.
 *
 * Roots (no deps): 2, 4, 7, 11, 12, 13.
 * Bits not in the map are treated as leaves with no dependents.
 */
const DEPENDENCIES: Record<number, number[]> = {
  2: [],            // PAN — root
  14: [2],          // Expiry — derived from PAN context
  35: [2, 14],      // Track 2 — composed from PAN + Expiry
  52: [2],          // PIN Block — XOR'd against PAN
  55: [2, 4, 9],    // EMV TLV — depends on PAN, Amount, Tx type
  4: [],            // Amount — root
  7: [],            // Transmission datetime — root (always current)
  11: [],           // STAN — root (sequential)
  12: [],
  13: [],
};

/** Inverse index: parent bit → bits that depend on it. */
const REVERSE_DEPS: Record<number, number[]> = (() => {
  const out: Record<number, number[]> = {};
  for (const [child, parents] of Object.entries(DEPENDENCIES)) {
    for (const p of parents) {
      (out[p] ||= []).push(Number(child));
    }
  }
  return out;
})();

/**
 * Returns the bits that should be marked `stale` when `changedBit` is edited.
 * Restricted to bits that are actually present in `presentBits`.
 */
export function getAffectedFields(changedBit: number, presentBits: Iterable<number>): number[] {
  const dependents = REVERSE_DEPS[changedBit] ?? [];
  const set = new Set<number>(presentBits);
  return dependents.filter((b) => set.has(b));
}

export function dependsOn(bit: number): number[] {
  return DEPENDENCIES[bit] ?? [];
}
