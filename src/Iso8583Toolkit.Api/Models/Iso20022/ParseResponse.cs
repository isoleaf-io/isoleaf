using System.ComponentModel;

namespace Iso8583Toolkit.Api.Models.Iso20022;

public record ParseResponse(
    [property: Description("Detected ISO 20022 message type, e.g. \"pacs.008.001.09\".")]
    string MessageType,
    [property: Description("Root XML namespace URI of the document.")]
    string Namespace,
    [property: Description("Human-readable summary extracted from the message: operation name, confidence level and a list of key fields.")]
    MessageSummary Summary,
    [property: Description("Document root as a recursive tree node.")]
    ParsedNode Root);

public record ParsedNode(
    [property: Description("Local element name, or \"@attr\" for an attribute.")]
    string Name,
    [property: Description("Leaf value. Null when the node is a container (has children).")]
    string? Value,
    [property: Description("Namespace hint when this node lives in a different XML namespace from the root (head + body case). Null when same as root.")]
    string? Namespace,
    [property: Description("Child nodes (elements + attributes flattened in document order).")]
    List<ParsedNode> Children);

public record MessageSummary(
    [property: Description("Plain-English name of the operation, e.g. \"FI-to-FI Customer Credit Transfer\".")]
    string Operation,
    [property: Description("\"full\" = every expected field was extracted, \"partial\" = some missing, \"unknown\" = message type recognised but no extractor implemented.")]
    string Confidence,
    [property: Description("Ordered list of key fields with their extracted values (or marked as missing).")]
    List<SummaryField> Fields,
    [property: Description("Statement entries (Ntry). Only set for camt.053; null for every other message type.")]
    List<StatementEntry>? Entries = null);

public record SummaryField(
    [property: Description("Display label, already localised, e.g. \"Valor\", \"Devedor\".")]
    string Label,
    [property: Description("Extracted value, or null if the field was expected but not present in the XML.")]
    string? Value,
    [property: Description("True when the value was successfully extracted; false marks an expected-but-missing field.")]
    bool Found);

public record StatementEntry(
    [property: Description("Entry amount as a string preserving the original precision; pair with Currency for display.")]
    string? Amount,
    [property: Description("ISO 4217 currency code for the amount.")]
    string? Currency,
    [property: Description("\"CRDT\" = credit (incoming) or \"DBIT\" = debit (outgoing).")]
    string? CreditDebitIndicator,
    [property: Description("Booking date — when the entry actually hit the account.")]
    string? BookingDate,
    [property: Description("Value date — when the entry is effective for interest calculation.")]
    string? ValueDate,
    [property: Description("Entry status, e.g. \"BOOK\", \"PDNG\", \"INFO\".")]
    string? Status,
    [property: Description("End-to-end ID of the originating transaction, if present.")]
    string? EndToEndId,
    [property: Description("Free-form remittance information (RmtInf/Ustrd).")]
    string? RemittanceInfo);
