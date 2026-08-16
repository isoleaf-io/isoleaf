using System.ComponentModel;

namespace Iso8583Toolkit.Application.Models.Iso20022;

public record ValidateRequest(
    [property: Description("Full ISO 20022 XML document to validate.")]
    string XmlContent,
    [property: Description("Optional message type override. When omitted, the namespace is auto-detected from the XML root.")]
    string? MessageType = null);

public record ValidationErrorDto(
    string Message,
    [property: Description("\"error\" or \"warning\".")]
    string Severity,
    int? LineNumber,
    int? LinePosition,
    [property: Description("XPath of the offending element, resolved from the line/column via XmlLineMapper. Null when the error sits outside any mapped element.")]
    string? XPath);

public record ValidateResponse(
    string MessageType,
    bool IsValid,
    int ErrorCount,
    int WarningCount,
    IReadOnlyList<ValidationErrorDto> Errors);
