import { describe, expect, it } from "vitest";
import { formatValidationMessage } from "@/pages/Iso20022Parser";

describe("formatValidationMessage", () => {
  it("rewrites 'has invalid child element' into a friendly sentence", () => {
    const raw =
      "The element 'GrpHdr' in namespace 'urn:...' has invalid child element 'NbOfTxs' in namespace 'urn:...'.";
    expect(formatValidationMessage(raw)).toContain(
      "Elemento 'NbOfTxs' está fora de ordem ou não é permitido aqui.",
    );
  });

  it("does NOT append 'Posição esperada após' when the error is an invalid-child case", () => {
    // The friendly child-element sentence is already actionable; the engine's
    // candidates list for this family tends to be noisy internal type names.
    const raw =
      "has invalid child element 'X' in namespace 'urn:foo'. " +
      "List of possible elements expected: 'CreDtTm' in namespace 'urn:foo'.";
    const out = formatValidationMessage(raw);
    expect(out).not.toContain("Posição esperada após");
    expect(out).not.toContain("CreDtTm");
  });

  it("truncates the candidates list to 5 with an 'e mais N' tail", () => {
    const items = ["A", "B", "C", "D", "E", "F", "G"]
      .map((n) => `'${n}' in namespace 'urn:x'`)
      .join(", ");
    const raw = `List of possible elements expected: ${items}.`;
    const out = formatValidationMessage(raw);
    expect(out).toMatch(/A, B, C, D, E e mais 2/);
  });

  it("collapses 'is not valid in the context'", () => {
    const raw = "Element 'X' is not valid in the context of foo.";
    expect(formatValidationMessage(raw)).toBe("Elemento não permitido neste contexto.");
  });

  it("extracts the offending value and element name from an 'element is invalid' message", () => {
    const raw =
      "The 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09:SttlmMtd' element is invalid - " +
      "The value 'INVALIDO' is invalid according to its datatype " +
      "'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.09:SettlementMethod1Code' - " +
      "The Enumeration constraint failed.";
    const out = formatValidationMessage(raw);
    expect(out).toBe("Valor 'INVALIDO' inválido para o elemento 'SttlmMtd'.");
  });

  it("strips the namespace prefix from the element name even without a colon", () => {
    // .NET versions that surface the element without a namespace prefix
    // must still produce a clean output — `split(':').pop()` returns the
    // input unchanged when no colon is present.
    const raw =
      "The 'NbOfTxs' element is invalid - The value 'NOT-A-NUMBER' is invalid " +
      "according to its datatype 'urn:foo:Max15NumericText' - The Pattern constraint failed.";
    expect(formatValidationMessage(raw)).toBe(
      "Valor 'NOT-A-NUMBER' inválido para o elemento 'NbOfTxs'.",
    );
  });

  it("falls back to the raw message (truncated at 200) when nothing matches", () => {
    const raw = "Some completely unrelated message".repeat(20);
    const out = formatValidationMessage(raw);
    expect(out.length).toBeLessThanOrEqual(201); // 200 chars + ellipsis
  });
});
