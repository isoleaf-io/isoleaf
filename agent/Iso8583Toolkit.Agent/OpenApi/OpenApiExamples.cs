using Microsoft.OpenApi.Any;

namespace Iso8583Toolkit.Agent.OpenApi;

/// <summary>
/// Canned request bodies surfaced as "Try it out" presets in the Scalar UI.
/// Keys follow the form "{METHOD}:/api/{controller}/{action}" — the same
/// shape the operation transformer derives from
/// <c>ApiDescription.RelativePath</c>.
///
/// Only the five publicly-supported endpoints have examples. Other endpoints
/// surface their summary/description via <c>[EndpointSummary]</c> /
/// <c>[EndpointDescription]</c> attributes on the action methods, but their
/// request body is left empty in the UI — by design, so users have to type
/// realistic input rather than assume the canned example is a contract.
///
/// Values intentionally use INVENTED hex / synthetic PANs and the test IMK
/// already published in the integration tests. None of this is real card or
/// issuer data.
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
        };
}
