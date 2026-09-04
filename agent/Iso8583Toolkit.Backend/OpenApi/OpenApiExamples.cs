using Microsoft.OpenApi.Any;

namespace Iso8583Toolkit.Backend.OpenApi;

/// <summary>
/// Canned request bodies surfaced as "Try it out" presets in the Scalar UI.
/// Keys follow the form "{METHOD}:/api/{controller}/{action}" — the same
/// shape the operation transformer derives from
/// <c>ApiDescription.RelativePath</c>.
///
/// Curated set covers the "headline" endpoints of each protocol — five for
/// ISO 8583 / EMV and four for ISO 20022 (the fifth ISO 20022 headline,
/// <c>GET /api/test-data/person</c>, takes no body — only a <c>locale</c>
/// query param — and therefore has no entry here). Every other endpoint
/// surfaces its summary/description via <c>[EndpointSummary]</c> /
/// <c>[EndpointDescription]</c> attributes on the action methods, but its
/// request body is left empty in the UI — by design, so users have to type
/// realistic input rather than assume the canned example is a contract.
///
/// Values intentionally use INVENTED hex / synthetic PANs and the test IMK
/// already published in the integration tests. None of this is real card or
/// issuer data. The ISO 20022 examples reuse ecosystem/scenario ids that
/// really exist in <c>ScenarioRegistry</c>.
/// </summary>
internal static class OpenApiExamples
{
    public static readonly IReadOnlyDictionary<string, IOpenApiAny> RequestBody =
        new Dictionary<string, IOpenApiAny>
        {
            // POST /api/parse/hex — a synthetic 0100 authorization request
            // (PAN 4111…, RRN, terminal info — all invented).
            ["POST:/api/parse/hex"] = new OpenApiObject
            {
                ["hexMessage"] = new OpenApiString(
                    "01007220000000800000164111111111111111000000000001000010" +
                    "000001112233445566778899111111223344556677"),
                ["layoutName"] = new OpenApiString("default"),
            },

            // POST /api/emv/parse-bit55 — TLV containing 9F26 (ARQC), 9F27
            // (Cryptogram Info Data), 9F10 (IAD), 9F37 (UN), 9F36 (ATC),
            // 9F1A (Country) and 95 (TVR). Same shape the EMV page consumes.
            ["POST:/api/emv/parse-bit55"] = new OpenApiObject
            {
                ["hexBit55"] = new OpenApiString(
                    "9F2608112233445566778899" +
                    "9F2701" + "80" +
                    "9F10080706010A03A4B0C0" +
                    "9F37046A5B4C3D" +
                    "9F3602001E" +
                    "9F1A020076" +
                    "9505" + "0000000000"),
                ["headerBytes"] = new OpenApiInteger(0),
            },

            // POST /api/cards/generate — minimal request, brand only.
            // CardholderName and Expiry are optional; backend fills them in.
            ["POST:/api/cards/generate"] = new OpenApiObject
            {
                ["brand"] = new OpenApiString("Visa"),
            },

            // POST /api/emv/generate-arqc — full ARQC computation input.
            // IMK matches the one used in the IsoCore.Tests integration suite.
            ["POST:/api/emv/generate-arqc"] = new OpenApiObject
            {
                ["issuerMasterKey"]      = new OpenApiString("0123456789ABCDEF0123456789ABCDEF"),
                ["pan"]                  = new OpenApiString("4111111111111111"),
                ["panSequenceNumber"]    = new OpenApiString("00"),
                ["atc"]                  = new OpenApiString("001E"),
                ["amountAuthorized"]     = new OpenApiString("000000001000"),
                ["amountOther"]          = new OpenApiString("000000000000"),
                ["terminalCountryCode"]  = new OpenApiString("0076"),
                ["tvr"]                  = new OpenApiString("0000000000"),
                ["currencyCode"]         = new OpenApiString("0986"),
                ["transactionDate"]      = new OpenApiString("250615"),
                ["transactionType"]      = new OpenApiString("00"),
                ["unpredictableNumber"]  = new OpenApiString("AABBCCDD"),
                ["aip"]                  = new OpenApiString("1800"),
                ["iad"]                  = new OpenApiString("0706010A03A40000"),
                ["profile"]              = new OpenApiString("Visa"),
            },

            // POST /api/emv/generate-arpc — issuer's response to a previously
            // generated ARQC. Method1 for Visa/Elo, Method2 for Mastercard.
            ["POST:/api/emv/generate-arpc"] = new OpenApiObject
            {
                ["arqc"]                 = new OpenApiString("112233445566778899AABBCCDDEE"),
                ["issuerMasterKey"]      = new OpenApiString("0123456789ABCDEF0123456789ABCDEF"),
                ["pan"]                  = new OpenApiString("4111111111111111"),
                ["panSequenceNumber"]    = new OpenApiString("00"),
                ["atc"]                  = new OpenApiString("001E"),
                ["authResponseCode"]     = new OpenApiString("3030"),
                ["csu"]                  = new OpenApiNull(),
                ["profile"]              = new OpenApiString("Visa"),
                ["method"]               = new OpenApiString("Method1"),
            },

            // POST /api/iso20022/builder/build — Pix Credit Transfer sample.
            // Uses the "brazilian-pix" ecosystem + "pix-credit-transfer"
            // scenario (both are registered in ScenarioRegistry) against
            // the current SPI version pacs.008.001.13. IncludeOptionalXPaths
            // is empty so the response returns only the ecosystem-mandatory
            // shape — the frontend uses this as its default first render.
            ["POST:/api/iso20022/builder/build"] = new OpenApiObject
            {
                ["messageType"]           = new OpenApiString("pacs.008.001.13"),
                ["scenarioId"]            = new OpenApiString("pix-credit-transfer"),
                ["includeOptionalXPaths"] = new OpenApiArray(),
            },

            // POST /api/iso20022/validate — round-trips a minimal pacs.008
            // shell against its embedded XSD. The `messageType` override
            // is left null so the validator auto-detects from the root
            // xmlns (the same path the Parser exercise takes).
            ["POST:/api/iso20022/validate"] = new OpenApiObject
            {
                ["xmlContent"] = new OpenApiString(
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                    "<Document xmlns=\"urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13\">\n" +
                    "  <FIToFICstmrCdtTrf>\n" +
                    "    <GrpHdr>\n" +
                    "      <MsgId>PIX20260710BANCO0001</MsgId>\n" +
                    "      <CreDtTm>2026-07-10T14:30:00Z</CreDtTm>\n" +
                    "      <NbOfTxs>1</NbOfTxs>\n" +
                    "      <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>\n" +
                    "    </GrpHdr>\n" +
                    "  </FIToFICstmrCdtTrf>\n" +
                    "</Document>"),
                ["messageType"] = new OpenApiNull(),
            },

            // POST /api/swift/mt/parse — synthetic MT103 with invented
            // reference (2262-XYZ), invented BICs (BANKBRSPXXX / BANKUS33XXX)
            // and a small USD amount. Never a real message.
            ["POST:/api/swift/mt/parse"] = new OpenApiObject
            {
                ["rawMessage"] = new OpenApiString(
                    "{1:F01BANKBRSPAXXX0000000000}" +
                    "{2:I103BANKUS33XXXXN}" +
                    "{4:\n" +
                    ":20:REF2262XYZ\n" +
                    ":23B:CRED\n" +
                    ":32A:260710USD1234,56\n" +
                    ":50K:/12345678901\n" +
                    "MARIA SILVA\n" +
                    ":59:/9876543210\n" +
                    "JOHN DOE\n" +
                    ":71A:SHA\n" +
                    "-}"),
            },

            // POST /api/pix/qrcode/generate — synthetic Pix key (invented
            // e-mail), small BRL amount and a Latin-only city that fits
            // EMV-MPM tag 60 (≤15 chars ASCII upper). SingleUse=false keeps
            // POI Method 11 (static QR).
            //
            // Amount is emitted as an integer (10 BRL) rather than a
            // fractional double: Microsoft.OpenApi 1.x serialises
            // OpenApiDouble via the current culture, which produces "12,34"
            // under pt-BR and breaks /openapi/v1.json as valid JSON. The
            // PixGenerateRequest DTO accepts decimal? so 10 binds cleanly.
            // Docs curl snippets in content.{pt,en}.ts mirror this value.
            ["POST:/api/pix/qrcode/generate"] = new OpenApiObject
            {
                ["pixKey"]        = new OpenApiString("teste@isoleaf.dev"),
                ["merchantName"]  = new OpenApiString("ISOLEAF TESTE"),
                ["merchantCity"]  = new OpenApiString("SAO PAULO"),
                ["amount"]        = new OpenApiInteger(10),
                ["txId"]          = new OpenApiString("ISOLEAF2026071000000001TX"),
                ["description"]   = new OpenApiString("Pagamento demo"),
                ["singleUse"]     = new OpenApiBoolean(false),
            },
        };
}
