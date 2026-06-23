using System.Xml;

namespace Iso8583Toolkit.Iso20022.Services;

/// <summary>
/// Reads an XML document once and produces a line-number → XPath map for
/// every element it sees. Used by the validator to enrich schema errors
/// (which only carry line/column from <see cref="IXmlLineInfo"/>) with the
/// XPath where the error happened, so the UI can highlight the right node
/// in the parsed tree.
/// </summary>
public static class XmlLineMapper
{
    /// <summary>
    /// Walks the supplied XML and returns a snapshot of every element start —
    /// keyed by the line number, valued by the slash-joined ancestor path
    /// excluding the root <c>Document</c> wrapper. Returns an empty dictionary
    /// when the input is empty or malformed (so callers don't need to wrap
    /// it in try/catch — the validator already reports the well-formed-ness
    /// error separately).
    /// </summary>
    public static IReadOnlyDictionary<int, string> Build(string xmlContent)
    {
        var map = new Dictionary<int, string>();
        if (string.IsNullOrWhiteSpace(xmlContent)) return map;

        var settings = new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
            IgnoreWhitespace = true,
            IgnoreComments = true,
            ValidationType = ValidationType.None,
        };

        try
        {
            using var reader = XmlReader.Create(new StringReader(xmlContent), settings);
            var lineInfo = reader as IXmlLineInfo;
            var stack = new Stack<string>();

            while (reader.Read())
            {
                if (reader.NodeType == XmlNodeType.Element)
                {
                    // Track the path *excluding* the outer <Document> wrapper —
                    // every FieldDefinition's XPath starts at the message root
                    // (e.g. "FIToFICstmrCdtTrf/GrpHdr/MsgId"), and we want the
                    // map keys to align with those XPaths directly.
                    var name = reader.LocalName;
                    var isDocument = stack.Count == 0 && name == "Document";

                    if (!isDocument)
                    {
                        stack.Push(name);
                        var xpath = string.Join('/', stack.Reverse());
                        if (lineInfo?.HasLineInfo() == true && lineInfo.LineNumber > 0)
                        {
                            // First writer wins — multiple events on the same line
                            // (e.g. <X attr="..."/>) all point at the same element.
                            map.TryAdd(lineInfo.LineNumber, xpath);
                        }

                        if (reader.IsEmptyElement) stack.Pop();
                    }
                }
                else if (reader.NodeType == XmlNodeType.EndElement
                         && reader.LocalName != "Document"
                         && stack.Count > 0)
                {
                    stack.Pop();
                }
            }
        }
        catch (XmlException)
        {
            // Malformed input. The validator handles that path separately.
        }

        return map;
    }
}
