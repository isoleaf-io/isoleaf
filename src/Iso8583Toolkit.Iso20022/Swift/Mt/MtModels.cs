namespace Iso8583Toolkit.Iso20022.Swift.Mt;

/// <summary>
/// How sure we are about the MT→MX mapping for a given field. Drives the
/// badge colour in the UI (Automatic = green, Ambiguous = yellow,
/// NoMapping = grey).
/// </summary>
public enum MtFieldConfidence
{
    /// <summary>Deterministic 1-to-1 mapping per SWIFT CBPR+/PMPG.</summary>
    Automatic,

    /// <summary>Free-format text or multiple valid MX targets — needs human review.</summary>
    Ambiguous,

    /// <summary>No equivalent in the ISO 20022 catalogue (e.g. SWIFT control blocks).</summary>
    NoMapping,
}

/// <summary>
/// One semantic piece extracted from a composite MT field (e.g. the date,
/// currency and amount halves of <c>:32A:</c>). <paramref name="MxValue"/>
/// is the value already converted to the MX shape — <c>YYMMDD</c> →
/// <c>YYYY-MM-DD</c>, BIC pass-through, etc.
/// </summary>
public sealed record MtSubField(
    string? SubId,
    string RawValue,
    string? ParsedValue,
    string? MxPath,
    string? MxValue,
    MtFieldConfidence Confidence,
    IReadOnlyList<string> MxAlternatives);

/// <summary>
/// A SWIFT MT field as parsed from a block — tag, official SWIFT name,
/// the raw value as it appeared in the message, and (when applicable) the
/// breakdown into typed sub-fields. <paramref name="MxAlternatives"/> is
/// populated when <see cref="Confidence"/> is <see cref="MtFieldConfidence.Ambiguous"/>
/// so the UI can show the list of plausible MX targets.
/// </summary>
public sealed record MtField(
    string Tag,
    string Name,
    string Description,
    string Format,
    string RawValue,
    MtFieldConfidence Confidence,
    IReadOnlyList<MtSubField> SubFields,
    string? MxPath,
    IReadOnlyList<string> MxAlternatives);

/// <summary>
/// One of the five SWIFT MT message blocks ({1:}, {2:}, {3:}, {4:}, {5:}).
/// Header blocks (1, 2, 5) carry a single synthetic field describing the
/// block; {3:} surfaces each tagged element (notably 121 = UETR); {4:} is
/// the body with all <c>:XX[Y]:</c> business fields.
/// </summary>
public sealed record MtBlock(
    string BlockId,
    string Name,
    string RawContent,
    IReadOnlyList<MtField> Fields);

/// <summary>
/// Parser output for a full MT message. <paramref name="MessageType"/>
/// is one of "MT103", "MT202", "MT202COV"; <paramref name="Warnings"/>
/// collects non-fatal parsing observations (unknown tag, missing UETR,
/// truncated block, etc.) without failing the parse.
/// </summary>
public sealed record MtParseResult(
    string MessageType,
    string? Sender,
    string? Receiver,
    string? Uetr,
    IReadOnlyList<MtBlock> Blocks,
    IReadOnlyList<string> Warnings);

/// <summary>
/// Static metadata for a tag in <see cref="MtFieldDictionary"/>.
/// <paramref name="SubFieldLabels"/>, when present, drives splitter logic
/// in the parser (e.g. <c>:32A:</c> → Data + Moeda + Valor); the parser
/// reads it to know how many sub-fields to expect.
/// </summary>
public sealed record MtFieldMeta(
    string Name,
    string Description,
    string Format,
    string? MxPath = null,
    MtFieldConfidence Confidence = MtFieldConfidence.Automatic,
    IReadOnlyList<string>? MxAlternatives = null,
    IReadOnlyList<string>? SubFieldLabels = null,
    IReadOnlyDictionary<string, string>? CodeMapping = null);
