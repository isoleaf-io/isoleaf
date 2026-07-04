using System.Globalization;
using System.Linq;
using System.Xml.Linq;
using Iso8583Toolkit.Iso20022.Schema;
using Iso8583Toolkit.Iso20022.Services;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Swift.Mt;

/// <summary>
/// Sprint 9.2 — turns a parsed MT message into either an MX mapping
/// preview (Mode A step 1), a fully-rendered pacs.008 / pacs.009 XML
/// document (Mode A step 2) or a field-by-field comparison against a
/// user-supplied MX (Mode B).
///
/// The Mode A converter routes through <see cref="ReferenceService"/> +
/// <see cref="XmlExampleGenerator"/>, so any pacs.008/pacs.009 version
/// embedded in the agent (currently .001.09 and .001.13 for pacs.008,
/// .001.09 and .001.12 for pacs.009) is a valid target — the caller
/// picks via <see cref="MtMxConvertRequest.TargetVersion"/>.
/// </summary>
public sealed class MtMxMapperService
{
    private const string Pacs008Family = "pacs.008";
    private const string Pacs009Family = "pacs.009";

    private readonly MtParserService _parser;
    private readonly SchemaRegistry _schemaRegistry;
    private readonly ReferenceService _referenceService;
    private readonly XmlExampleGenerator _xmlExampleGenerator;
    private readonly Iso20022ValidatorService _validator;

    public MtMxMapperService(
        MtParserService parser,
        SchemaRegistry schemaRegistry,
        ReferenceService referenceService,
        XmlExampleGenerator xmlExampleGenerator,
        Iso20022ValidatorService validator)
    {
        ArgumentNullException.ThrowIfNull(parser);
        ArgumentNullException.ThrowIfNull(schemaRegistry);
        ArgumentNullException.ThrowIfNull(referenceService);
        ArgumentNullException.ThrowIfNull(xmlExampleGenerator);
        ArgumentNullException.ThrowIfNull(validator);
        _parser = parser;
        _schemaRegistry = schemaRegistry;
        _referenceService = referenceService;
        _xmlExampleGenerator = xmlExampleGenerator;
        _validator = validator;
    }

    /// <summary>
    /// Lists every embedded pacs.008 / pacs.009 version, most recent
    /// first. Exposed via <c>GET /api/swift/mt/versions</c> so the UI
    /// can populate the target-version selector.
    /// </summary>
    public IReadOnlyList<SchemaInfo> ListAvailableVersions(string messageTypePrefix)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(messageTypePrefix);
        return _schemaRegistry.ListSupportedTypes()
            .Where(t => t.MessageType.StartsWith(
                messageTypePrefix, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(t => t.MessageType, StringComparer.Ordinal)
            .ToList();
    }

    private SchemaInfo LatestVersion(string prefix) =>
        ListAvailableVersions(prefix).FirstOrDefault()
        ?? throw new InvalidOperationException(
            $"Nenhum XSD embarcado para o prefixo '{prefix}'.");

    // ── Mode A step 1: mapping preview ────────────────────────────────

    public MtMxMappingTable BuildMappingTable(string rawMessage)
    {
        var parsed = _parser.Parse(rawMessage);
        var targetMx = TargetMxTypeFor(parsed.MessageType);
        var block4 = parsed.Blocks.FirstOrDefault(b => b.BlockId == "4");
        var rows = new List<MtMxMappingRow>();

        if (block4 is null)
        {
            return new MtMxMappingTable(
                parsed.MessageType, targetMx, rows,
                [.. parsed.Warnings, "Bloco {4:} ausente — nenhum campo para mapear."]);
        }

        foreach (var field in block4.Fields)
        {
            if (field.SubFields.Count > 0)
            {
                foreach (var sub in field.SubFields)
                {
                    var path = sub.MxPath ?? field.MxPath ?? string.Empty;
                    rows.Add(new MtMxMappingRow(
                        Tag: $":{field.Tag}:",
                        SubId: sub.SubId,
                        RawValue: sub.RawValue,
                        ParsedValue: sub.ParsedValue,
                        SuggestedMxPath: path,
                        SuggestedMxValue: sub.MxValue ?? sub.ParsedValue ?? sub.RawValue,
                        Confidence: sub.Confidence,
                        MxAlternatives: sub.MxAlternatives.Count > 0
                            ? sub.MxAlternatives
                            : field.MxAlternatives,
                        IsEditable: sub.Confidence == MtFieldConfidence.Ambiguous));
                }
            }
            else
            {
                rows.Add(new MtMxMappingRow(
                    Tag: $":{field.Tag}:",
                    SubId: null,
                    RawValue: field.RawValue,
                    ParsedValue: null,
                    SuggestedMxPath: field.MxPath ?? string.Empty,
                    SuggestedMxValue: field.RawValue,
                    Confidence: field.Confidence,
                    MxAlternatives: field.MxAlternatives,
                    IsEditable: field.Confidence == MtFieldConfidence.Ambiguous));
            }
        }

        return new MtMxMappingTable(parsed.MessageType, targetMx, rows, parsed.Warnings);
    }

    private string TargetMxTypeFor(string mtType) => mtType switch
    {
        "MT103" => LatestVersion(Pacs008Family).MessageType,
        "MT202" or "MT202COV" => LatestVersion(Pacs009Family).MessageType,
        _ => LatestVersion(Pacs008Family).MessageType,
    };

    private static string TargetPrefixFor(string mtType) => mtType switch
    {
        "MT103" => Pacs008Family,
        "MT202" or "MT202COV" => Pacs009Family,
        _ => throw new InvalidOperationException(
            $"Conversion not supported for {mtType}"),
    };

    // ── Mode A step 2: convert MT → pacs.008 / pacs.009 XML ───────────

    /// <summary>
    /// Renders the parsed MT into the requested MX version by driving
    /// <see cref="XmlExampleGenerator"/> — that gives us the correct XSD
    /// sequence, the right namespace and support for whichever version
    /// of pacs.008/009 is embedded, without a hand-written XLinq path
    /// per version. Overrides are layered: MT-derived values first,
    /// then <see cref="MtMxConvertRequest.UserOverrides"/> on top so
    /// the user's Mode A choice wins over the automatic mapping.
    /// </summary>
    public MtMxConvertResult Convert(MtMxConvertRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var parsed = _parser.Parse(request.RawMessage);
        var prefix = TargetPrefixFor(parsed.MessageType);

        // Resolve the target version: caller-supplied suffix ("001.13"),
        // caller-supplied full messageType ("pacs.008.001.09"), or the
        // most recent embedded version when null.
        var available = ListAvailableVersions(prefix);
        if (available.Count == 0)
            throw new InvalidOperationException(
                $"No XSD found for {prefix}");

        var target = string.IsNullOrEmpty(request.TargetVersion)
            ? available[0]
            : available.FirstOrDefault(t =>
                t.MessageType.Equals(request.TargetVersion, StringComparison.OrdinalIgnoreCase)
                || t.MessageType.EndsWith("." + request.TargetVersion, StringComparison.OrdinalIgnoreCase)
                || t.Version.Equals(request.TargetVersion, StringComparison.OrdinalIgnoreCase))
                ?? throw new ArgumentException(
                    $"Version {request.TargetVersion} not available for {prefix}");

        var fields = _referenceService.GetFields(target.MessageType)
            ?? throw new InvalidOperationException(
                $"Fields not found for {target.MessageType}");
        var ns = target.Namespace;

        // Combine MT-derived values with user overrides. User picks
        // override anything the MT parser wrote — this is how the Mode A
        // "Confirmar mapeamento" flow rewires ambiguous fields.
        var overrides = ExtractMtValues(parsed);
        if (request.UserOverrides is { } uo)
            foreach (var kv in uo) overrides[kv.Key] = kv.Value;

        // Every override key doubles as an "opt-in optional" hint —
        // XmlExampleGenerator would otherwise skip optional branches
        // like PmtId/UETR, RmtInf/Ustrd, IntrmyAgt1 that the MT filled
        // in. Feeding the same set as includeOptionalXPaths (with
        // ancestor expansion) surfaces those branches in the output.
        var include = new HashSet<string>(StringComparer.Ordinal);
        foreach (var key in overrides.Keys) AddWithAncestors(include, StripAttribute(key));

        var xml = _xmlExampleGenerator.GenerateMinimal(ns, fields, overrides, include);

        // Downstream tooling gets the schema validation for free —
        // emit XSD errors as warnings on the response so the UI can
        // flag misconfigured user overrides without hiding the XML.
        var warnings = new List<string>(parsed.Warnings);
        var validation = _validator.Validate(xml);
        if (!validation.IsValid)
        {
            warnings.AddRange(validation.Issues
                .Where(i => string.Equals(i.Severity, "error", StringComparison.OrdinalIgnoreCase))
                .Select(i => i.Message));
        }

        return new MtMxConvertResult(parsed.MessageType, target.MessageType, xml, warnings);
    }

    /// <summary>Strips a trailing <c>/@attr</c> to expose the parent element path.</summary>
    private static string StripAttribute(string xpath)
    {
        var atIdx = xpath.LastIndexOf("/@", StringComparison.Ordinal);
        return atIdx > 0 ? xpath[..atIdx] : xpath;
    }

    private static void AddWithAncestors(HashSet<string> set, string xpath)
    {
        if (string.IsNullOrEmpty(xpath)) return;
        set.Add(xpath);
        var slash = xpath.LastIndexOf('/');
        while (slash > 0)
        {
            xpath = xpath[..slash];
            if (!set.Add(xpath)) return;
            slash = xpath.LastIndexOf('/');
        }
    }

    /// <summary>
    /// Extracts the MT values as XmlExampleGenerator-shaped overrides.
    /// Every key is the full XSD XPath rooted at the message body
    /// (<c>FIToFICstmrCdtTrf/…</c> for MT103, <c>FICdtTrf/…</c> for
    /// MT202/COV) so the generator can pin the leaf directly.
    /// </summary>
    private static Dictionary<string, string> ExtractMtValues(MtParseResult parsed)
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal);
        var root = parsed.MessageType == "MT103" ? "FIToFICstmrCdtTrf" : "FICdtTrf";
        var txRoot = $"{root}/CdtTrfTxInf";

        // Block 3 UETR (:121:) — surfaced as a top-level result field so
        // we don't need to hunt through the block below.
        if (!string.IsNullOrEmpty(parsed.Uetr))
            values[$"{txRoot}/PmtId/UETR"] = parsed.Uetr;

        var block4 = parsed.Blocks.FirstOrDefault(b => b.BlockId == "4");
        if (block4 is null) return values;

        foreach (var field in block4.Fields)
        {
            switch (field.Tag)
            {
                case "20":
                    values[$"{root}/GrpHdr/MsgId"] = field.RawValue;
                    values[$"{txRoot}/PmtId/InstrId"] = field.RawValue;
                    values[$"{txRoot}/PmtId/EndToEndId"] = field.RawValue;
                    break;

                case "21":
                    values[$"{txRoot}/PmtId/EndToEndId"] = field.RawValue;
                    break;

                case "32A":
                    var date = SubValue(field, "Data");
                    var ccy = SubValue(field, "Moeda");
                    var amt = SubValue(field, "Valor");
                    if (date is not null) values[$"{txRoot}/IntrBkSttlmDt"] = date;
                    if (ccy is not null) values[$"{txRoot}/IntrBkSttlmAmt/@Ccy"] = ccy;
                    if (amt is not null) values[$"{txRoot}/IntrBkSttlmAmt"] = amt;
                    break;

                case "71A":
                    // Prefer the subfield's mapped MxValue when the
                    // parser already applied OUR→DEBT / SHA→SHAR / BEN→CRED;
                    // fall back to a literal map otherwise.
                    var mapped = field.SubFields.FirstOrDefault()?.MxValue
                        ?? field.RawValue.Trim() switch
                        {
                            "OUR" => "DEBT",
                            "SHA" => "SHAR",
                            "BEN" => "CRED",
                            _ => "SHAR",
                        };
                    values[$"{txRoot}/ChrgBr"] = mapped;
                    break;

                case "50K" or "50F":
                    ApplyPartyAccount(values, field,
                        namePath: $"{txRoot}/Dbtr/Nm",
                        acctBase: $"{txRoot}/DbtrAcct");
                    break;

                case "50A":
                    // MT202COV: ordering party is a financial institution.
                    values[$"{txRoot}/Dbtr/FinInstnId/BICFI"] = field.RawValue.Trim();
                    break;

                case "52A":
                    if (parsed.MessageType == "MT103")
                        values[$"{txRoot}/DbtrAgt/FinInstnId/BICFI"] = field.RawValue.Trim();
                    else
                        values[$"{txRoot}/Dbtr/FinInstnId/BICFI"] = field.RawValue.Trim();
                    break;

                case "53A":
                    values[$"{txRoot}/IntrmyAgt1/FinInstnId/BICFI"] = field.RawValue.Trim();
                    break;

                case "54A":
                    values[$"{txRoot}/CdtrAgt/FinInstnId/BICFI"] = field.RawValue.Trim();
                    break;

                case "56A":
                    values[$"{txRoot}/IntrmyAgt2/FinInstnId/BICFI"] = field.RawValue.Trim();
                    break;

                case "57A":
                    values[$"{txRoot}/CdtrAgt/FinInstnId/BICFI"] = field.RawValue.Trim();
                    break;

                case "58A":
                    values[$"{txRoot}/Cdtr/FinInstnId/BICFI"] = field.RawValue.Trim();
                    break;

                case "59" or "59F":
                    ApplyPartyAccount(values, field,
                        namePath: $"{txRoot}/Cdtr/Nm",
                        acctBase: $"{txRoot}/CdtrAcct");
                    break;

                case "59A":
                    values[$"{txRoot}/Cdtr/FinInstnId/BICFI"] = field.RawValue.Trim();
                    break;

                case "70":
                    values[$"{txRoot}/RmtInf/Ustrd"] = field.RawValue.Trim();
                    break;
            }
        }

        // GrpHdr scaffolding — always present in a fresh pacs.
        if (!values.ContainsKey($"{root}/GrpHdr/MsgId"))
            values[$"{root}/GrpHdr/MsgId"] = Guid.NewGuid().ToString("N")[..16];
        values[$"{root}/GrpHdr/CreDtTm"] =
            DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
        values[$"{root}/GrpHdr/NbOfTxs"] = "1";
        values[$"{root}/GrpHdr/SttlmInf/SttlmMtd"] = "CLRG";

        return values;
    }

    private static string? SubValue(MtField field, string subId) =>
        field.SubFields.FirstOrDefault(s => s.SubId == subId)?.ParsedValue
        ?? field.SubFields.FirstOrDefault(s => s.SubId == subId)?.RawValue;

    private static void ApplyPartyAccount(
        Dictionary<string, string> values,
        MtField field,
        string namePath,
        string acctBase)
    {
        foreach (var sub in field.SubFields)
        {
            switch (sub.SubId)
            {
                case "Conta":
                    var acc = sub.ParsedValue ?? sub.RawValue;
                    if (string.IsNullOrEmpty(acc)) break;
                    values[IsIban(acc)
                        ? $"{acctBase}/Id/IBAN"
                        : $"{acctBase}/Id/Othr/Id"] = acc;
                    break;

                case "Nome":
                    values[namePath] = sub.ParsedValue ?? sub.RawValue;
                    break;
            }
        }
    }

    private static bool IsIban(string value) =>
        value.Length is >= 15 and <= 34
        && char.IsLetter(value[0]) && char.IsLetter(value[1])
        && value.Skip(2).All(char.IsLetterOrDigit);

    // Legacy hand-written pacs.008 / pacs.009 XLinq builders removed:
    // Convert now delegates to XmlExampleGenerator via the overrides
    // populated by ExtractMtValues.

    // ── Mode B: compare an MT against a user-supplied MX ──────────────

    public MtMxCompareResult Compare(string rawMt, string rawMx)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rawMt);
        ArgumentException.ThrowIfNullOrWhiteSpace(rawMx);

        var mapping = BuildMappingTable(rawMt);
        XDocument mxDoc;
        try { mxDoc = XDocument.Parse(rawMx); }
        catch (Exception ex)
        {
            throw new ArgumentException($"MX inválido: {ex.Message}", nameof(rawMx));
        }

        var mxType = DetectMxType(mxDoc);
        var mxValues = new Dictionary<string, string>(StringComparer.Ordinal);
        FlattenMxValues(mxDoc.Root, mxValues);

        var rows = new List<MtMxCompareRow>();
        var consumedMxPaths = new HashSet<string>(StringComparer.Ordinal);

        foreach (var mr in mapping.Rows.Where(mr => !string.IsNullOrEmpty(mr.SuggestedMxPath)))
        {
            var mxValue = FindMxValue(mxValues, mr.SuggestedMxPath);
            if (mxValue is not null)
                consumedMxPaths.Add(mr.SuggestedMxPath);

            var (status, note) = CompareValues(
                mr.SuggestedMxValue, mr.SuggestedMxPath, mxValue);

            rows.Add(new MtMxCompareRow(
                MtTag: mr.Tag,
                MtSubId: mr.SubId,
                MtValue: mr.ParsedValue ?? mr.RawValue,
                MxPath: mr.SuggestedMxPath,
                MxValue: mxValue,
                Status: status,
                Note: note));
        }

        // Surface MX-only fields the MT didn't cover (Match on OrgId,
        // MsgId etc. are noise — filter to the interesting leaves).
        foreach (var kv in mxValues)
        {
            if (consumedMxPaths.Contains(kv.Key)) continue;
            if (!IsInterestingMxLeaf(kv.Key)) continue;
            rows.Add(new MtMxCompareRow(
                MtTag: "—",
                MtSubId: null,
                MtValue: null,
                MxPath: kv.Key,
                MxValue: kv.Value,
                Status: MtMxCompareStatus.OnlyInMx,
                Note: "Presente no MX, sem tag MT correspondente."));
        }

        var matches = rows.Count(r => r.Status == MtMxCompareStatus.Match);
        var diverges = rows.Count(r => r.Status == MtMxCompareStatus.Diverge);
        var onlyMt = rows.Count(r => r.Status == MtMxCompareStatus.OnlyInMt);
        var onlyMx = rows.Count(r => r.Status == MtMxCompareStatus.OnlyInMx);
        // "Compatível" means every field the two messages share agrees.
        // OnlyInMt / OnlyInMx are informational — one side didn't carry
        // that leaf, but the two messages don't disagree about it.
        var compatible = diverges == 0;

        return new MtMxCompareResult(
            mapping.MessageType, mxType, rows,
            matches, diverges, onlyMt, onlyMx, compatible);
    }

    private static (MtMxCompareStatus, string?) CompareValues(
        string? mtValue, string mxPath, string? mxValue)
    {
        if (string.IsNullOrEmpty(mxValue))
            return (MtMxCompareStatus.OnlyInMt, "Campo ausente no XML MX.");
        if (string.IsNullOrEmpty(mtValue))
            return (MtMxCompareStatus.OnlyInMx, "Valor MT vazio para essa linha.");

        var (a, b) = (Normalise(mtValue), Normalise(mxValue));
        if (a == b) return (MtMxCompareStatus.Match, null);

        // Charge bearer: OUR/SHA/BEN ↔ DEBT/SHAR/CRED are equivalent.
        if (mxPath == "ChrgBr")
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["OUR"] = "DEBT", ["SHA"] = "SHAR", ["BEN"] = "CRED",
            };
            if (map.TryGetValue(mtValue, out var mapped)
                && mapped.Equals(mxValue, StringComparison.OrdinalIgnoreCase))
                return (MtMxCompareStatus.Match, $"{mtValue}→{mapped}: equivalentes.");
        }

        // Amounts: normalise comma vs dot decimal separator.
        if (decimal.TryParse(a.Replace(',', '.'), NumberStyles.Number,
                CultureInfo.InvariantCulture, out var da)
            && decimal.TryParse(b.Replace(',', '.'), NumberStyles.Number,
                CultureInfo.InvariantCulture, out var db)
            && da == db)
            return (MtMxCompareStatus.Match, null);

        return (MtMxCompareStatus.Diverge, $"MT '{mtValue}' vs MX '{mxValue}'.");
    }

    private static string Normalise(string value) => value.Trim().ToUpperInvariant();

    private static string DetectMxType(XDocument doc)
    {
        var ns = doc.Root?.Name.NamespaceName ?? "";
        // Namespaces follow ...pacs.008.001.13 / pacs.009.001.12 shape.
        var idx = ns.LastIndexOf(':');
        return idx >= 0 ? ns[(idx + 1)..] : "unknown";
    }

    /// <summary>
    /// Walks an MX document producing a canonical path → value dictionary
    /// keyed by the tail of the XPath (e.g. <c>Dbtr/Nm</c>, <c>IntrBkSttlmAmt</c>).
    /// The path is the last N segments starting from the leaf so callers
    /// can match against the MT dictionary paths without knowing the
    /// concrete message-root element.
    /// </summary>
    private static void FlattenMxValues(XElement? root, Dictionary<string, string> map)
    {
        if (root is null) return;
        foreach (var child in root.Descendants())
        {
            if (child.HasElements) continue;
            var path = BuildPath(child);
            if (!map.ContainsKey(path))
                map[path] = child.Value.Trim();
            // Attributes on the leaf's parent become /parent/@attr keys —
            // covers <IntrBkSttlmAmt Ccy="USD">.
            foreach (var attr in child.Attributes())
            {
                var attrPath = $"{path}/@{attr.Name.LocalName}";
                if (!map.ContainsKey(attrPath))
                    map[attrPath] = attr.Value.Trim();
            }
        }
    }

    private static string BuildPath(XElement el)
    {
        // Full path up to (but not including) the <Document> root so
        // NormalizePath can strip the FIToFICstmrCdtTrf/CdtTrfTxInf/…
        // wrapper cleanly. Skipping Document keeps the keys anchored on
        // the message body (e.g. FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Nm).
        var parts = new List<string>();
        var cur = el;
        while (cur is not null && cur.Parent is not null)
        {
            parts.Add(cur.Name.LocalName);
            cur = cur.Parent;
            if (cur is not null && cur.Name.LocalName == "Document") break;
        }
        parts.Reverse();
        return string.Join('/', parts);
    }

    /// <summary>
    /// Match an MT-side path against the flattened MX map. The dictionary
    /// carries short tail paths (e.g. <c>Dbtr/Nm</c>, <c>CdtrAcct/Id</c>)
    /// while the flattened MX has full paths like
    /// <c>FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Nm</c>. <see cref="PathsMatch"/>
    /// strips well-known FIToFI/FICdtTrf roots on both sides and then
    /// compares the trailing N segments. Choice arms like <c>CdtrAcct/Id</c>
    /// are also expanded to their <c>/IBAN</c> and <c>/Othr/Id</c> variants.
    /// </summary>
    private static string? FindMxValue(Dictionary<string, string> mxValues, string mtPath)
    {
        foreach (var candidate in ExpandPath(mtPath))
        {
            if (mxValues.TryGetValue(candidate, out var direct)) return direct;
            foreach (var kv in mxValues)
            {
                if (PathsMatch(candidate, kv.Key)) return kv.Value;
            }
        }
        return null;
    }

    /// <summary>
    /// Expands a short MX path into every plausible XSD variant. Callers
    /// (e.g. :59: /account) hand us <c>CdtrAcct/Id</c> but the XML target
    /// could be either <c>CdtrAcct/Id/IBAN</c> or
    /// <c>CdtrAcct/Id/Othr/Id</c> — we try each in turn.
    /// </summary>
    private static IEnumerable<string> ExpandPath(string mtPath)
    {
        yield return mtPath;
        if (mtPath.EndsWith("Acct/Id", StringComparison.Ordinal))
        {
            yield return mtPath + "/IBAN";
            yield return mtPath + "/Othr/Id";
        }
    }

    private static bool PathsMatch(string mtPath, string mxFullPath)
    {
        var mt = NormalizePath(mtPath);
        var mx = NormalizePath(mxFullPath);

        // Fast path: trailing substring match.
        if (mx.Equals(mt, StringComparison.OrdinalIgnoreCase)) return true;
        if (mx.EndsWith("/" + mt, StringComparison.OrdinalIgnoreCase)) return true;

        // Segmented tail match — covers the case where MX still carries a
        // deeper prefix after normalisation (e.g. TxDtls/CdtrAcct/Id).
        var mtSegments = mt.Split('/');
        var mxSegments = mx.Split('/');
        if (mxSegments.Length < mtSegments.Length) return false;
        var mxTail = string.Join('/', mxSegments[^mtSegments.Length..]);
        return string.Equals(mxTail, mt, StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizePath(string path)
    {
        // ISO 20022 pacs.008/009 messages are anchored at either
        // FIToFICstmrCdtTrf or FICdtTrf; strip the well-known root
        // prefixes so the tail-comparison below only sees business
        // segments (Dbtr/Nm, CdtrAcct/Id, IntrBkSttlmAmt, …).
        string[] prefixes =
        [
            "FIToFICstmrCdtTrf/CdtTrfTxInf/",
            "FIToFICstmrCdtTrf/GrpHdr/",
            "FIToFICstmrCdtTrf/",
            "FICdtTrf/CdtTrfTxInf/",
            "FICdtTrf/GrpHdr/",
            "FICdtTrf/",
        ];
        foreach (var prefix in prefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return path[prefix.Length..];
        }
        return path;
    }

    private static bool IsInterestingMxLeaf(string path)
    {
        // Suppress boilerplate MX leaves that the MT never carries —
        // dumping them as "OnlyInMx" would bury real findings.
        var boring = new[] { "MsgId", "CreDtTm", "NbOfTxs", "SttlmMtd", "InstrId" };
        return !boring.Any(b => path.EndsWith(b, StringComparison.Ordinal));
    }
}
