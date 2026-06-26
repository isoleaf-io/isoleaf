using System.Text;
using System.Xml;
using System.Xml.Linq;
using System.Xml.Schema;
using Iso8583Toolkit.Iso20022.Validation;

namespace Iso8583Toolkit.Iso20022.Services;

/// <summary>
/// Generates a return/response skeleton from an original ISO 20022 message.
/// Extracts cross-reference fields (original MsgId, EndToEndId, UETR, …)
/// and emits the matching response type:
/// <list type="bullet">
///   <item><c>pacs.008</c> → <c>pacs.004</c> (default) or <c>pacs.002</c>.</item>
///   <item><c>pacs.009</c> → <c>pacs.004</c> (default) or <c>pacs.002</c>.</item>
///   <item><c>pacs.004</c> → <c>pacs.002</c>.</item>
///   <item><c>pain.001</c> → <c>pain.002</c>.</item>
/// </list>
/// Stateless, safe as a singleton.
/// </summary>
public sealed class ReturnGeneratorService
{
    private readonly SchemaRegistry _schemaRegistry;

    // Pinned target namespaces for the emitted skeletons. The user can still
    // edit the rendered XML to point at a different variant — these defaults
    // just have to be valid embedded XSDs.
    private const string Pacs004ReturnNs = "urn:iso:std:iso:20022:tech:xsd:pacs.004.001.10";
    private const string Pacs002ReturnNs = "urn:iso:std:iso:20022:tech:xsd:pacs.002.001.11";
    private const string Pain002ReturnNs = "urn:iso:std:iso:20022:tech:xsd:pain.002.001.12";

    private static readonly Dictionary<string, (string Default, string[] Available)>
        ReturnMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["pacs.008"] = ("pacs.004", ["pacs.004", "pacs.002"]),
            ["pacs.009"] = ("pacs.004", ["pacs.004", "pacs.002"]),
            ["pacs.004"] = ("pacs.002", ["pacs.002"]),
            ["pain.001"] = ("pain.002", ["pain.002"]),
        };

    public ReturnGeneratorService(SchemaRegistry schemaRegistry)
    {
        ArgumentNullException.ThrowIfNull(schemaRegistry);
        _schemaRegistry = schemaRegistry;
    }

    /// <summary>
    /// Generates a return/response XML skeleton from an ISO 20022 input message,
    /// optionally targeting a specific return message type.
    /// </summary>
    /// <exception cref="ArgumentException">XML is empty, the prefix isn't routed, or the requested target type is unknown.</exception>
    /// <exception cref="InvalidOperationException">Namespace doesn't match any registered XSD.</exception>
    public ReturnGeneratorResult Generate(string xmlContent, string? targetMessageType = null)
    {
        if (string.IsNullOrWhiteSpace(xmlContent))
            throw new ArgumentException("XML content is required.", nameof(xmlContent));

        var originalMessageType = _schemaRegistry.DetectMessageType(xmlContent)
            ?? throw new InvalidOperationException(
                "Cannot detect message type from XML namespace.");

        // Check routing FIRST — running XSD validation on, say, a camt.053
        // would fail at the schema layer and surface as
        // "XML content failed schema validation" when the real reason is
        // that we just don't generate returns for that family. Caller gets
        // the precise ArgumentException with the supported list instead.
        var prefix = ExtractPrefix(originalMessageType);

        if (!ReturnMap.TryGetValue(prefix, out var returnInfo))
            throw new ArgumentException(
                $"Return generation not supported for '{prefix}'. " +
                $"Supported: {string.Join(", ", ReturnMap.Keys)}",
                nameof(xmlContent));

        var returnPrefix = targetMessageType is null
            ? returnInfo.Default
            : ExtractPrefix(targetMessageType);

        if (!returnInfo.Available.Contains(returnPrefix, StringComparer.OrdinalIgnoreCase))
            throw new ArgumentException(
                $"Target type '{returnPrefix}' not available for source '{prefix}'. " +
                $"Available: {string.Join(", ", returnInfo.Available)}",
                nameof(targetMessageType));

        // Resolve namespace from messageType using the real SchemaRegistry
        // API — there's no GetNamespaceForMessageType / GetSchemaContent;
        // ListSupportedTypes + GetSchema(namespace) is the supported path.
        var schemaInfo = _schemaRegistry
            .ListSupportedTypes()
            .FirstOrDefault(s => string.Equals(
                s.MessageType, originalMessageType,
                StringComparison.OrdinalIgnoreCase));

        if (schemaInfo is null)
            throw new InvalidOperationException(
                $"Schema not found for message type '{originalMessageType}'.");

        var schema = _schemaRegistry.GetSchema(schemaInfo.Namespace);
        if (schema is null)
            throw new InvalidOperationException(
                $"Could not load XSD for namespace '{schemaInfo.Namespace}'.");

        var schemas = new XmlSchemaSet();
        schemas.Add(schema);
        schemas.Compile();

        var settings = new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
            ValidationType = ValidationType.Schema,
            ValidationFlags = XmlSchemaValidationFlags.None,
            Schemas = schemas,
        };
        settings.ValidationEventHandler += (_, e) =>
            throw e.Exception ?? new XmlSchemaValidationException(e.Message);

        XDocument doc;
        try
        {
            using var reader = XmlReader.Create(new StringReader(xmlContent), settings);
            reader.MoveToContent();
            doc = XDocument.Load(reader, LoadOptions.SetLineInfo);
        }
        catch (XmlException ex)
        {
            throw new ArgumentException("XML content is not a valid ISO 20022 document.", nameof(xmlContent), ex);
        }
        catch (XmlSchemaValidationException ex)
        {
            throw new ArgumentException("XML content failed schema validation.", nameof(xmlContent), ex);
        }

        var rootNs = doc.Root?.Name.NamespaceName ?? string.Empty;

        var ns = XNamespace.Get(rootNs);
        var xml = returnPrefix switch
        {
            "pacs.004" => GeneratePacs004(doc, ns, originalMessageType),
            "pacs.002" => GeneratePacs002(doc, ns, originalMessageType),
            "pain.002" => GeneratePain002(doc, ns, originalMessageType),
            _ => throw new ArgumentException(
                $"Unsupported return type: {returnPrefix}",
                nameof(targetMessageType)),
        };

        return new ReturnGeneratorResult(
            OriginalMessageType: originalMessageType,
            ReturnMessageType: returnPrefix,
            Xml: xml,
            AvailableReturnTypes: returnInfo.Available);
    }

    private static string ExtractPrefix(string messageType)
    {
        var parts = messageType.Split('.');
        return parts.Length >= 2 ? $"{parts[0]}.{parts[1]}" : messageType;
    }

    // ---- pacs.004 ----------------------------------------------------------

    private static string GeneratePacs004(
        XDocument doc, XNamespace ns, string originalType)
    {
        // pacs.008 and pacs.009 both land here — read the appropriate
        // container off the root before pulling fields.
        var ftof = doc.Root?.Element(ns + "FIToFICstmrCdtTrf");
        var fict = doc.Root?.Element(ns + "FICdtTrf");
        var hdr = ftof?.Element(ns + "GrpHdr") ?? fict?.Element(ns + "GrpHdr");
        var tx = ftof?.Element(ns + "CdtTrfTxInf") ?? fict?.Element(ns + "CdtTrfTxInf");

        var orgnlMsgId = hdr?.Element(ns + "MsgId")?.Value ?? string.Empty;
        var pmtId = tx?.Element(ns + "PmtId");
        var orgnlE2EId = pmtId?.Element(ns + "EndToEndId")?.Value ?? string.Empty;
        var orgnlTxId = pmtId?.Element(ns + "TxId")?.Value;
        var orgnlUETR = pmtId?.Element(ns + "UETR")?.Value;
        var amtEl = tx?.Element(ns + "IntrBkSttlmAmt");
        var amt = amtEl?.Value ?? "0.00";
        var ccy = amtEl?.Attribute("Ccy")?.Value ?? "USD";

        // CdtrAgt becomes the "returner debtor agent" because the money is
        // moving back from the receiver to the sender.
        var cdtrBic = tx?.Element(ns + "CdtrAgt")
                       ?.Element(ns + "FinInstnId")
                       ?.Element(ns + "BICFI")?.Value;

        var now = DateTime.UtcNow;
        var msgId = $"RET{now:yyyyMMdd}{ShortToken()}";
        var creDtTm = now.ToString("yyyy-MM-ddTHH:mm:ss");

        var sb = new StringBuilder();
        sb.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        sb.AppendLine($"""<Document xmlns="{Pacs004ReturnNs}">""");
        sb.AppendLine("  <PmtRtr>");
        sb.AppendLine("    <GrpHdr>");
        sb.AppendLine($"      <MsgId>{Esc(msgId)}</MsgId>");
        sb.AppendLine($"      <CreDtTm>{creDtTm}</CreDtTm>");
        sb.AppendLine("      <NbOfTxs>1</NbOfTxs>");
        sb.AppendLine("      <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>");
        sb.AppendLine("    </GrpHdr>");
        sb.AppendLine("    <TxInf>");
        sb.AppendLine("      <OrgnlGrpInf>");
        sb.AppendLine($"        <OrgnlMsgId>{Esc(orgnlMsgId)}</OrgnlMsgId>");
        sb.AppendLine($"        <OrgnlMsgNmId>{Esc(originalType)}</OrgnlMsgNmId>");
        sb.AppendLine("      </OrgnlGrpInf>");
        sb.AppendLine($"      <OrgnlEndToEndId>{Esc(orgnlE2EId)}</OrgnlEndToEndId>");
        if (!string.IsNullOrEmpty(orgnlTxId))
            sb.AppendLine($"      <OrgnlTxId>{Esc(orgnlTxId)}</OrgnlTxId>");
        if (!string.IsNullOrEmpty(orgnlUETR))
            sb.AppendLine($"      <OrgnlUETR>{Esc(orgnlUETR)}</OrgnlUETR>");
        sb.AppendLine($"""      <RtrdIntrBkSttlmAmt Ccy="{Esc(ccy)}">{Esc(amt)}</RtrdIntrBkSttlmAmt>""");
        sb.AppendLine("      <RtrRsnInf>");
        sb.AppendLine("        <Rsn><Cd>FOCR</Cd></Rsn>");
        sb.AppendLine("      </RtrRsnInf>");
        if (!string.IsNullOrEmpty(cdtrBic))
        {
            sb.AppendLine("      <RtrChain>");
            sb.AppendLine("        <Dbtr>");
            sb.AppendLine($"          <Agt><FinInstnId><BICFI>{Esc(cdtrBic)}</BICFI></FinInstnId></Agt>");
            sb.AppendLine("        </Dbtr>");
            sb.AppendLine("      </RtrChain>");
        }
        sb.AppendLine("    </TxInf>");
        sb.AppendLine("  </PmtRtr>");
        sb.Append("</Document>");
        return sb.ToString();
    }

    // ---- pacs.002 ----------------------------------------------------------

    private static string GeneratePacs002(
        XDocument doc, XNamespace ns, string originalType)
    {
        // pacs.002 is the universal status report — same skeleton serves
        // pacs.008, pacs.009 and pacs.004 originals.
        XElement? hdr = null;
        XElement? tx = null;
        var ftof = doc.Root?.Element(ns + "FIToFICstmrCdtTrf");
        if (ftof is not null) { hdr = ftof.Element(ns + "GrpHdr"); tx = ftof.Element(ns + "CdtTrfTxInf"); }
        var fict = doc.Root?.Element(ns + "FICdtTrf");
        if (fict is not null) { hdr = fict.Element(ns + "GrpHdr"); tx = fict.Element(ns + "CdtTrfTxInf"); }
        var pmtr = doc.Root?.Element(ns + "PmtRtr");
        if (pmtr is not null) { hdr = pmtr.Element(ns + "GrpHdr"); tx = pmtr.Element(ns + "TxInf"); }

        var orgnlMsgId = hdr?.Element(ns + "MsgId")?.Value ?? string.Empty;
        // A return carries the original ids under different names; fall back
        // to those when the source isn't a pacs.008/009.
        var orgnlE2EId = tx?.Element(ns + "PmtId")?.Element(ns + "EndToEndId")?.Value
                      ?? tx?.Element(ns + "OrgnlEndToEndId")?.Value
                      ?? string.Empty;
        var orgnlTxId = tx?.Element(ns + "PmtId")?.Element(ns + "TxId")?.Value
                     ?? tx?.Element(ns + "OrgnlTxId")?.Value;

        var now = DateTime.UtcNow;
        var msgId = $"STS{now:yyyyMMdd}{ShortToken()}";
        var creDtTm = now.ToString("yyyy-MM-ddTHH:mm:ss");

        var sb = new StringBuilder();
        sb.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        sb.AppendLine($"""<Document xmlns="{Pacs002ReturnNs}">""");
        sb.AppendLine("  <FIToFIPmtStsRpt>");
        sb.AppendLine("    <GrpHdr>");
        sb.AppendLine($"      <MsgId>{Esc(msgId)}</MsgId>");
        sb.AppendLine($"      <CreDtTm>{creDtTm}</CreDtTm>");
        sb.AppendLine("    </GrpHdr>");
        sb.AppendLine("    <OrgnlGrpInfAndSts>");
        sb.AppendLine($"      <OrgnlMsgId>{Esc(orgnlMsgId)}</OrgnlMsgId>");
        sb.AppendLine($"      <OrgnlMsgNmId>{Esc(originalType)}</OrgnlMsgNmId>");
        sb.AppendLine("    </OrgnlGrpInfAndSts>");
        sb.AppendLine("    <TxInfAndSts>");
        sb.AppendLine($"      <OrgnlEndToEndId>{Esc(orgnlE2EId)}</OrgnlEndToEndId>");
        if (!string.IsNullOrEmpty(orgnlTxId))
            sb.AppendLine($"      <OrgnlTxId>{Esc(orgnlTxId)}</OrgnlTxId>");
        sb.AppendLine("      <TxSts>ACCP</TxSts>");
        sb.AppendLine("    </TxInfAndSts>");
        sb.AppendLine("  </FIToFIPmtStsRpt>");
        sb.Append("</Document>");
        return sb.ToString();
    }

    // ---- pain.002 ----------------------------------------------------------

    private static string GeneratePain002(
        XDocument doc, XNamespace ns, string originalType)
    {
        var root = doc.Root?.Element(ns + "CstmrCdtTrfInitn");
        var hdr = root?.Element(ns + "GrpHdr");
        var pmtInf = root?.Element(ns + "PmtInf");
        var tx = pmtInf?.Element(ns + "CdtTrfTxInf");

        var orgnlMsgId = hdr?.Element(ns + "MsgId")?.Value ?? string.Empty;
        var orgnlE2EId = tx?.Element(ns + "PmtId")?.Element(ns + "EndToEndId")?.Value
                      ?? string.Empty;
        var pmtInfId = pmtInf?.Element(ns + "PmtInfId")?.Value;

        var now = DateTime.UtcNow;
        var msgId = $"STS{now:yyyyMMdd}{ShortToken()}";
        var creDtTm = now.ToString("yyyy-MM-ddTHH:mm:ss");

        var sb = new StringBuilder();
        sb.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        sb.AppendLine($"""<Document xmlns="{Pain002ReturnNs}">""");
        sb.AppendLine("  <CstmrPmtStsRpt>");
        sb.AppendLine("    <GrpHdr>");
        sb.AppendLine($"      <MsgId>{Esc(msgId)}</MsgId>");
        sb.AppendLine($"      <CreDtTm>{creDtTm}</CreDtTm>");
        sb.AppendLine("    </GrpHdr>");
        sb.AppendLine("    <OrgnlGrpInfAndSts>");
        sb.AppendLine($"      <OrgnlMsgId>{Esc(orgnlMsgId)}</OrgnlMsgId>");
        sb.AppendLine($"      <OrgnlMsgNmId>{Esc(originalType)}</OrgnlMsgNmId>");
        sb.AppendLine("      <GrpSts>ACCP</GrpSts>");
        sb.AppendLine("    </OrgnlGrpInfAndSts>");
        if (!string.IsNullOrEmpty(pmtInfId))
        {
            sb.AppendLine("    <OrgnlPmtInfAndSts>");
            sb.AppendLine($"      <OrgnlPmtInfId>{Esc(pmtInfId)}</OrgnlPmtInfId>");
            sb.AppendLine("      <PmtInfSts>ACCP</PmtInfSts>");
            sb.AppendLine("      <TxInfAndSts>");
            sb.AppendLine($"        <OrgnlEndToEndId>{Esc(orgnlE2EId)}</OrgnlEndToEndId>");
            sb.AppendLine("        <TxSts>ACCP</TxSts>");
            sb.AppendLine("      </TxInfAndSts>");
            sb.AppendLine("    </OrgnlPmtInfAndSts>");
        }
        sb.AppendLine("  </CstmrPmtStsRpt>");
        sb.Append("</Document>");
        return sb.ToString();
    }

    private static string ShortToken() => Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();

    private static string Esc(string s) =>
        s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
}

public sealed record ReturnGeneratorResult(
    string OriginalMessageType,
    string ReturnMessageType,
    string Xml,
    IReadOnlyList<string> AvailableReturnTypes);
