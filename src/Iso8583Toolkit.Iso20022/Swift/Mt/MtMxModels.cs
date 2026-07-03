namespace Iso8583Toolkit.Iso20022.Swift.Mt;

/// <summary>
/// One row of the MT→MX mapping table surfaced to the UI. For Automatic
/// tags <paramref name="IsEditable"/> is <c>false</c> and the front-end
/// renders the MX path as plain text; for Ambiguous tags the UI shows a
/// dropdown seeded from <paramref name="MxAlternatives"/> and the user's
/// choice overrides <paramref name="SuggestedMxPath"/> when Convert runs.
/// </summary>
public sealed record MtMxMappingRow(
    string Tag,
    string? SubId,
    string RawValue,
    string? ParsedValue,
    string SuggestedMxPath,
    string? SuggestedMxValue,
    MtFieldConfidence Confidence,
    IReadOnlyList<string> MxAlternatives,
    bool IsEditable);

public sealed record MtMxMappingTable(
    string MessageType,
    string TargetMxType,
    IReadOnlyList<MtMxMappingRow> Rows,
    IReadOnlyList<string> Warnings);

/// <summary>
/// Convert request payload. <paramref name="TargetVersion"/> is the
/// version suffix inside the pacs family (e.g. <c>"001.13"</c> or
/// <c>"001.09"</c>) — leave null to fall back to the most recent
/// version embedded in the agent. <paramref name="UserOverrides"/> maps
/// an MX path (e.g. <c>Dbtr/Nm</c>) to the value the user picked in the
/// mapping table; keys not present here fall back to the automatic
/// suggestion from <see cref="MtMxMapperService.BuildMappingTable"/>.
/// </summary>
public sealed record MtMxConvertRequest(
    string RawMessage,
    string? TargetVersion,
    IReadOnlyDictionary<string, string>? UserOverrides);

public sealed record MtMxConvertResult(
    string OriginalMessageType,
    string GeneratedMxType,
    string Xml,
    IReadOnlyList<string> Warnings);

public enum MtMxCompareStatus
{
    /// <summary>Values are semantically equivalent (post normalisation).</summary>
    Match,
    /// <summary>Both sides carry a value but they disagree.</summary>
    Diverge,
    /// <summary>MT has the field but the MX target is empty.</summary>
    OnlyInMt,
    /// <summary>MX carries something the MT didn't map.</summary>
    OnlyInMx,
}

public sealed record MtMxCompareRow(
    string MtTag,
    string? MtSubId,
    string? MtValue,
    string MxPath,
    string? MxValue,
    MtMxCompareStatus Status,
    string? Note);

public sealed record MtMxCompareResult(
    string MtMessageType,
    string MxMessageType,
    IReadOnlyList<MtMxCompareRow> Rows,
    int MatchCount,
    int DivergenceCount,
    int OnlyInMtCount,
    int OnlyInMxCount,
    bool IsCompatible);
