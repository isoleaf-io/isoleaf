namespace Iso8583Toolkit.Api.Models.Iso20022;

public record GenerateReturnRequest(
    string XmlContent,
    /// <summary>When null, the service picks the default return type for the
    /// detected source family (pacs.008 → pacs.004, pain.001 → pain.002, …).</summary>
    string? TargetMessageType = null);

public record GenerateReturnResponse(
    string OriginalMessageType,
    string ReturnMessageType,
    string Xml,
    IReadOnlyList<string> AvailableReturnTypes);
