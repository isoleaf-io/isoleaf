using System.ComponentModel;

namespace Iso8583Toolkit.Api.Models.Iso20022;

public record ParseRequest(
    [property: Description("Full ISO 20022 XML document (Document root). UTF-8 encoded; XML declaration optional.")]
    string XmlContent);
