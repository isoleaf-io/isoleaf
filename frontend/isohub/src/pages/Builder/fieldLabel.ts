/**
 * Brand-specific naming convention for field references.
 *   Mastercard → "DE n"
 *   Visa       → "Field n"
 *   default    → "Bit n"
 */
export function getFieldLabel(brand: string, bitNumber: number): string {
  const b = (brand || "").toLowerCase();
  if (b === "mastercard") return `DE ${bitNumber}`;
  if (b === "visa") return `Field ${bitNumber}`;
  return `Bit ${bitNumber}`;
}
