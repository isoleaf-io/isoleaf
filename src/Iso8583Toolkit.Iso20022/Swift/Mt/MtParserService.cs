using System.Globalization;
using System.Text.RegularExpressions;

namespace Iso8583Toolkit.Iso20022.Swift.Mt;

/// <summary>
/// Parses SWIFT MT103, MT202 and MT202COV envelopes into the typed
/// <see cref="MtParseResult"/> tree. Detects the message type from the
/// <c>{2:}</c> application header (I103 → MT103; I202 disambiguated by
/// presence of <c>:50:</c>/<c>:59:</c> in <c>{4:}</c> — those mark a
/// MT202COV cover payment). Stateless, safe as a singleton.
/// </summary>
public sealed class MtParserService
{
    // Block matcher — captures id and inner content. Blocks are nested
    // ({3:{121:uuid}}) so we walk the brace level rather than rely on a
    // single non-greedy regex.
    private static readonly Regex BodyFieldRegex = new(
        @":(?<tag>[0-9]{2}[A-Z]?):",
        RegexOptions.Compiled);

    // {3:} sub-tags — keyed pairs like {121:uuid}, {108:reference}.
    private static readonly Regex Block3TagRegex = new(
        @"\{(?<key>[0-9]{1,4}):(?<value>[^{}]*)\}",
        RegexOptions.Compiled);

    public MtParseResult Parse(string rawMessage)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rawMessage);
        var warnings = new List<string>();

        var blocks = SplitTopLevelBlocks(rawMessage).ToList();
        if (blocks.Count == 0)
            throw new ArgumentException(
                "Mensagem MT inválida: nenhum bloco {N:...} encontrado.",
                nameof(rawMessage));

        var (messageType, sender, receiver) = DetectMessageType(blocks, warnings);
        var uetr = ExtractUetr(blocks);

        var typedBlocks = new List<MtBlock>(blocks.Count);
        foreach (var (id, content) in blocks)
        {
            typedBlocks.Add(BuildBlock(id, content, warnings));
        }

        // MT202 vs MT202COV: the cover payment carries the underlying
        // customer credit transfer inside the same {4:} via :50: and :59:.
        // If we promised "MT202" but found those tags, upgrade the label.
        if (messageType == "MT202"
            && typedBlocks.Any(b => b.BlockId == "4"
                && b.Fields.Any(f => f.Tag.StartsWith("50") || f.Tag.StartsWith("59"))))
        {
            messageType = "MT202COV";
        }

        return new MtParseResult(messageType, sender, receiver, uetr, typedBlocks, warnings);
    }

    // ─── Block splitting ────────────────────────────────────────────────

    private static IEnumerable<(string Id, string Content)> SplitTopLevelBlocks(string raw)
    {
        var i = 0;
        while (i < raw.Length)
        {
            if (raw[i] != '{') { i++; continue; }

            // Header opens with {N: — capture digits up to the colon.
            var colon = raw.IndexOf(':', i + 1);
            if (colon < 0) yield break;
            var id = raw[(i + 1)..colon];
            // Walk braces to find the matching close (handles {3:{121:...}}).
            var depth = 1;
            var j = colon + 1;
            while (j < raw.Length && depth > 0)
            {
                if (raw[j] == '{') depth++;
                else if (raw[j] == '}') depth--;
                j++;
            }
            if (depth != 0) yield break;
            var content = raw[(colon + 1)..(j - 1)];
            yield return (id, content);
            i = j;
        }
    }

    // ─── Type detection ─────────────────────────────────────────────────

    private static (string Type, string? Sender, string? Receiver) DetectMessageType(
        IReadOnlyList<(string Id, string Content)> blocks,
        List<string> warnings)
    {
        var block1 = blocks.FirstOrDefault(b => b.Id == "1").Content;
        var block2 = blocks.FirstOrDefault(b => b.Id == "2").Content;
        // F01<sender BIC 12 chars>... — BIC is positions 3..15 of the block.
        string? sender = block1 is { Length: >= 15 } ? block1.Substring(3, 12) : null;
        string? receiver = null;
        var type = "UNKNOWN";

        if (block2 is { Length: >= 16 })
        {
            // I103<receiver BIC 12 chars>... or O103<reply receiver>...
            // The first char ('I'/'O') marks input vs output; chars 1..3 are
            // the message type code (103, 202, …). MT202COV is signalled by
            // the "COV" suffix right after "I202" — when present, the BIC
            // starts three chars later than the plain-MT202 case.
            var mtCode = block2.Substring(1, 3);
            var bicStart = 4;
            if (mtCode == "202"
                && block2.Length >= 19
                && block2.Substring(4, 3).Equals("COV", StringComparison.OrdinalIgnoreCase))
            {
                type = "MT202COV";
                bicStart = 7;
            }
            else
            {
                type = mtCode switch
                {
                    "103" => "MT103",
                    "202" => "MT202",
                    _ => $"MT{mtCode}",
                };
            }
            // Header BICs are always 12 chars (BIC8 + branch code XXX).
            receiver = bicStart + 12 <= block2.Length
                ? block2.Substring(bicStart, 12)
                : null;
        }
        else
        {
            warnings.Add(
                "Bloco {2:} ausente ou muito curto — tipo de mensagem não pôde ser detectado.");
        }

        if (type is not ("MT103" or "MT202" or "MT202COV"))
        {
            // Surface but don't fail — the controller turns this into 422.
            warnings.Add($"Tipo {type} não suportado pelo parser (apenas MT103/MT202/MT202COV).");
        }

        return (type, sender, receiver);
    }

    private static string? ExtractUetr(IReadOnlyList<(string Id, string Content)> blocks)
    {
        var b3 = blocks.FirstOrDefault(b => b.Id == "3").Content;
        if (string.IsNullOrEmpty(b3)) return null;
        var m = Block3TagRegex.Matches(b3)
            .FirstOrDefault(x => x.Groups["key"].Value == "121");
        return m?.Groups["value"].Value;
    }

    // ─── Block expansion ────────────────────────────────────────────────

    private MtBlock BuildBlock(string id, string content, List<string> warnings)
    {
        var fields = id switch
        {
            "1" => BuildHeaderField("Block1", content),
            "2" => BuildHeaderField("Block2", content),
            "3" => BuildBlock3Fields(content),
            "4" => BuildBlock4Fields(content, warnings),
            "5" => BuildHeaderField("Block5", content),
            _ => [(MtField)new("?", id, "Bloco desconhecido", "—", content,
                    MtFieldConfidence.NoMapping, [], null, [])],
        };
        return new MtBlock(id, BlockName(id), content, fields);
    }

    private static string BlockName(string id) => id switch
    {
        "1" => "Basic Header",
        "2" => "Application Header",
        "3" => "User Header",
        "4" => "Text Block",
        "5" => "Trailer",
        _ => $"Block {id}",
    };

    private static IReadOnlyList<MtField> BuildHeaderField(string pseudoTag, string content)
    {
        var meta = MtFieldDictionary.Lookup(pseudoTag);
        return
        [
            new(
                Tag: pseudoTag,
                Name: meta?.Name ?? pseudoTag,
                Description: meta?.Description ?? string.Empty,
                Format: meta?.Format ?? string.Empty,
                RawValue: content,
                Confidence: meta?.Confidence ?? MtFieldConfidence.NoMapping,
                SubFields: [],
                MxPath: meta?.MxPath,
                MxAlternatives: meta?.MxAlternatives ?? []),
        ];
    }

    private IReadOnlyList<MtField> BuildBlock3Fields(string content)
    {
        var fields = new List<MtField>();
        foreach (Match m in Block3TagRegex.Matches(content))
        {
            var key = m.Groups["key"].Value;
            var value = m.Groups["value"].Value;
            var pseudoTag = $"Block3_{key}";
            var meta = MtFieldDictionary.Lookup(pseudoTag);
            fields.Add(new MtField(
                Tag: key,
                Name: meta?.Name ?? $"Block 3 tag {key}",
                Description: meta?.Description ?? string.Empty,
                Format: meta?.Format ?? string.Empty,
                RawValue: value,
                Confidence: meta?.Confidence ?? MtFieldConfidence.NoMapping,
                SubFields: [],
                MxPath: meta?.MxPath,
                MxAlternatives: meta?.MxAlternatives ?? []));
        }
        return fields;
    }

    private IReadOnlyList<MtField> BuildBlock4Fields(string content, List<string> warnings)
    {
        // {4:} payload is delimited by a trailing '-' on its own line —
        // strip if present so the last field doesn't carry the marker.
        var body = content.TrimStart('\r', '\n').TrimEnd('\r', '\n', '-', ' ', '\t');

        var fields = new List<MtField>();
        var matches = BodyFieldRegex.Matches(body);
        for (var i = 0; i < matches.Count; i++)
        {
            var m = matches[i];
            var tag = m.Groups["tag"].Value;
            var start = m.Index + m.Length;
            var end = i + 1 < matches.Count ? matches[i + 1].Index : body.Length;
            var rawValue = body[start..end].Trim('\r', '\n');

            var meta = MtFieldDictionary.Lookup(tag);
            if (meta is null)
            {
                warnings.Add($"Tag :{tag}: não mapeada no MtFieldDictionary — exibida em modo cru.");
                fields.Add(new MtField(
                    Tag: tag,
                    Name: $"Unknown :{tag}:",
                    Description: "Tag desconhecida.",
                    Format: string.Empty,
                    RawValue: rawValue,
                    Confidence: MtFieldConfidence.NoMapping,
                    SubFields: [],
                    MxPath: null,
                    MxAlternatives: []));
                continue;
            }

            var subFields = ParseSubFields(tag, rawValue, meta);
            fields.Add(new MtField(
                Tag: tag,
                Name: meta.Name,
                Description: meta.Description,
                Format: meta.Format,
                RawValue: rawValue,
                Confidence: meta.Confidence,
                SubFields: subFields,
                MxPath: meta.MxPath,
                MxAlternatives: meta.MxAlternatives ?? []));
        }
        return fields;
    }

    // ─── Sub-field parsing ──────────────────────────────────────────────

    private static IReadOnlyList<MtSubField> ParseSubFields(string tag, string raw, MtFieldMeta meta)
    {
        if (meta.CodeMapping is { Count: > 0 })
        {
            // E.g. :71A:SHA → MxValue "SHAR" via OUR/SHA/BEN → DEBT/SHAR/CRED.
            var key = raw.Trim();
            var mapped = meta.CodeMapping.TryGetValue(key, out var v) ? v : null;
            return
            [
                new MtSubField(
                    SubId: null,
                    RawValue: key,
                    ParsedValue: key,
                    MxPath: meta.MxPath,
                    MxValue: mapped,
                    Confidence: mapped is null
                        ? MtFieldConfidence.Ambiguous
                        : MtFieldConfidence.Automatic,
                    MxAlternatives: []),
            ];
        }

        return tag switch
        {
            "32A" => Parse32A(raw),
            "33B" => Parse33B(raw),
            "50K" or "59" => ParseFreeFormatAddress(raw, isCreditor: tag == "59"),
            _ => [],
        };
    }

    private static IReadOnlyList<MtSubField> Parse32A(string raw)
    {
        // YYMMDD (6) + CCY (3) + amount (rest, comma-decimal).
        if (raw.Length < 10)
            return [];
        var datePart = raw[..6];
        var ccy = raw.Substring(6, 3);
        var amt = raw[9..].Replace(',', '.');
        var iso = TryParseYymmdd(datePart);
        return
        [
            new MtSubField("Data", datePart, iso ?? datePart, "IntrBkSttlmDt", iso,
                iso is null ? MtFieldConfidence.Ambiguous : MtFieldConfidence.Automatic, []),
            new MtSubField("Moeda", ccy, ccy, "IntrBkSttlmAmt/@Ccy", ccy,
                MtFieldConfidence.Automatic, []),
            new MtSubField("Valor", raw[9..], amt, "IntrBkSttlmAmt", amt,
                MtFieldConfidence.Automatic, []),
        ];
    }

    private static IReadOnlyList<MtSubField> Parse33B(string raw)
    {
        if (raw.Length < 4) return [];
        var ccy = raw[..3];
        var amt = raw[3..].Replace(',', '.');
        return
        [
            new MtSubField("Moeda", ccy, ccy, "InstdAmt/@Ccy", ccy,
                MtFieldConfidence.Automatic, []),
            new MtSubField("Valor", raw[3..], amt, "InstdAmt", amt,
                MtFieldConfidence.Automatic, []),
        ];
    }

    private static IReadOnlyList<MtSubField> ParseFreeFormatAddress(string raw, bool isCreditor)
    {
        var lines = raw.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length == 0) return [];

        var subs = new List<MtSubField>();
        var firstLine = lines[0];
        var nameLineIndex = 0;
        // Optional account on line 0 — convention is /1234 or /IBAN format.
        if (firstLine.StartsWith('/'))
        {
            var acct = firstLine.TrimStart('/');
            subs.Add(new MtSubField(
                SubId: "Conta",
                RawValue: firstLine,
                ParsedValue: acct,
                MxPath: isCreditor ? "CdtrAcct/Id" : "DbtrAcct/Id",
                MxValue: acct,
                Confidence: MtFieldConfidence.Ambiguous,
                MxAlternatives: isCreditor
                    ? ["CdtrAcct/Id/IBAN", "CdtrAcct/Id/Othr/Id"]
                    : ["DbtrAcct/Id/IBAN", "DbtrAcct/Id/Othr/Id"]));
            nameLineIndex = 1;
        }
        if (nameLineIndex < lines.Length)
        {
            subs.Add(new MtSubField(
                SubId: "Nome",
                RawValue: lines[nameLineIndex],
                ParsedValue: lines[nameLineIndex],
                MxPath: isCreditor ? "Cdtr/Nm" : "Dbtr/Nm",
                MxValue: lines[nameLineIndex],
                Confidence: MtFieldConfidence.Automatic,
                MxAlternatives: []));
        }
        for (var i = nameLineIndex + 1; i < lines.Length; i++)
        {
            subs.Add(new MtSubField(
                SubId: $"Endereço linha {i - nameLineIndex}",
                RawValue: lines[i],
                ParsedValue: lines[i],
                MxPath: isCreditor ? "Cdtr/PstlAdr/AdrLine" : "Dbtr/PstlAdr/AdrLine",
                MxValue: lines[i],
                Confidence: MtFieldConfidence.Ambiguous,
                MxAlternatives: isCreditor
                    ? ["Cdtr/PstlAdr/AdrLine", "Cdtr/PstlAdr/StrtNm",
                       "Cdtr/PstlAdr/TwnNm", "Cdtr/PstlAdr/Ctry"]
                    : ["Dbtr/PstlAdr/AdrLine", "Dbtr/PstlAdr/StrtNm",
                       "Dbtr/PstlAdr/TwnNm", "Dbtr/PstlAdr/Ctry"]));
        }
        return subs;
    }

    private static string? TryParseYymmdd(string yymmdd)
    {
        if (yymmdd.Length != 6) return null;
        if (!int.TryParse(yymmdd[..2], NumberStyles.Integer, CultureInfo.InvariantCulture, out var yy)
            || !int.TryParse(yymmdd[2..4], NumberStyles.Integer, CultureInfo.InvariantCulture, out var mm)
            || !int.TryParse(yymmdd[4..6], NumberStyles.Integer, CultureInfo.InvariantCulture, out var dd))
            return null;
        // SWIFT MT uses 2-digit years — pivot at 50 per ISO 8601 sliding
        // window (00-49 → 2000s, 50-99 → 1900s).
        var year = yy < 50 ? 2000 + yy : 1900 + yy;
        try { return new DateTime(year, mm, dd).ToString("yyyy-MM-dd"); }
        catch { return null; }
    }
}
