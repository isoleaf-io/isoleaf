namespace Iso8583Toolkit.Iso20022.Builder;

/// <summary>
/// One real-world payment ecosystem that consumes ISO 20022 messages with
/// its own conventions on top of the bare XSD (e.g. Brazilian Pix, SEPA,
/// SWIFT CBPR+, T2, plus a "generic" passthrough for ISO-only fields).
/// </summary>
public sealed record EcosystemInfo(
    string EcosystemId,
    string DisplayName,
    string Description);

/// <summary>
/// Functional scenario inside an ecosystem — pairs a message family with the
/// ecosystem-specific defaults, mandatory fields and hints the builder
/// surfaces in the editor.
/// </summary>
/// <param name="ScenarioId">Stable lookup id (e.g. <c>pix-credit-transfer</c>).</param>
/// <param name="EcosystemId">The owning ecosystem.</param>
/// <param name="MessageTypePrefix">Family+subId prefix (e.g. <c>pacs.008</c>); the literal <c>*</c> matches any message type and is used by the generic ecosystem.</param>
/// <param name="DisplayName">Short label for the dropdown.</param>
/// <param name="Description">One-liner shown next to the dropdown.</param>
/// <param name="FieldOverrides">XPath → contextual default value. Substitutes the placeholder produced by <see cref="Schema.XmlExampleGenerator"/>.</param>
/// <param name="AdditionalMandatoryXPaths">XPaths that the ecosystem requires above and beyond the XSD's <c>minOccurs=1</c>.</param>
/// <param name="FieldHints">XPath → hint shown next to the editor input.</param>
public sealed record ScenarioDefinition(
    string ScenarioId,
    string EcosystemId,
    string MessageTypePrefix,
    string DisplayName,
    string Description,
    IReadOnlyDictionary<string, string> FieldOverrides,
    IReadOnlyList<string> AdditionalMandatoryXPaths,
    IReadOnlyDictionary<string, string> FieldHints);
