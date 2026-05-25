using Iso8583Toolkit.IsoCore.Domain;

namespace Iso8583Toolkit.IsoCore.Layouts;

/// <summary>
/// Describes the full set of field definitions that apply to a particular ISO 8583 variant.
/// A layout is the schema against which raw messages are parsed.
/// </summary>
public sealed class IsoLayout
{
    /// <summary>Human-readable name, e.g. "ISO 8583-1:1987 Default".</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>ISO version label, e.g. "1987".</summary>
    public string Version { get; init; } = string.Empty;

    /// <summary>Field definitions keyed by bit number (1–128).</summary>
    public Dictionary<int, IsoFieldDefinition> Fields { get; init; } = new();

    /// <summary>Returns the definition for <paramref name="bitNumber"/>, or <c>null</c> if not defined.</summary>
    public IsoFieldDefinition? GetField(int bitNumber) =>
        Fields.TryGetValue(bitNumber, out var def) ? def : null;

    /// <summary>Returns <c>true</c> when a definition exists for <paramref name="bitNumber"/>.</summary>
    public bool HasField(int bitNumber) => Fields.ContainsKey(bitNumber);

    // ── Default layout ───────────────────────────────────────────────────────

    /// <summary>
    /// Returns a pre-populated layout containing the most common ISO 8583 fields
    /// as defined by the ISO 8583-1:1987 standard.
    /// </summary>
    public static IsoLayout Default() => new()
    {
        Name    = "ISO 8583-1:1987 Default",
        Version = "1987",
        Fields  = new Dictionary<int, IsoFieldDefinition>
        {
            // ── Primary bitmap (bits 2–64) ──────────────────────────────────
            // Bit 1 is the secondary-bitmap indicator — never a data field.

            [2]  = Def(2,  "Primary Account Number",              IsoFieldType.LLVAR,    19, IsoFieldEncoding.ASCII,  "PAN"),
            [3]  = Def(3,  "Processing Code",                     IsoFieldType.Fixed,     6, IsoFieldEncoding.ASCII),
            [4]  = Def(4,  "Amount, Transaction",                 IsoFieldType.Fixed,    12, IsoFieldEncoding.ASCII),
            [5]  = Def(5,  "Amount, Settlement",                  IsoFieldType.Fixed,    12, IsoFieldEncoding.ASCII),
            [6]  = Def(6,  "Amount, Cardholder Billing",          IsoFieldType.Fixed,    12, IsoFieldEncoding.ASCII),
            [7]  = Def(7,  "Transmission Date & Time",            IsoFieldType.Fixed,    10, IsoFieldEncoding.ASCII),
            [8]  = Def(8,  "Amount, Cardholder Billing Fee",      IsoFieldType.Fixed,     8, IsoFieldEncoding.ASCII),
            [9]  = Def(9,  "Conversion Rate, Settlement",         IsoFieldType.Fixed,     8, IsoFieldEncoding.ASCII),
            [10] = Def(10, "Conversion Rate, Cardholder Billing", IsoFieldType.Fixed,     8, IsoFieldEncoding.ASCII),
            [11] = Def(11, "Systems Trace Audit Number",          IsoFieldType.Fixed,     6, IsoFieldEncoding.ASCII, "STAN"),
            [12] = Def(12, "Local Transaction Time",              IsoFieldType.Fixed,     6, IsoFieldEncoding.ASCII),
            [13] = Def(13, "Local Transaction Date",              IsoFieldType.Fixed,     4, IsoFieldEncoding.ASCII),
            [14] = Def(14, "Expiration Date",                     IsoFieldType.Fixed,     4, IsoFieldEncoding.ASCII),
            [15] = Def(15, "Settlement Date",                     IsoFieldType.Fixed,     4, IsoFieldEncoding.ASCII),
            [16] = Def(16, "Currency Conversion Date",            IsoFieldType.Fixed,     4, IsoFieldEncoding.ASCII),
            [17] = Def(17, "Capture Date",                        IsoFieldType.Fixed,     4, IsoFieldEncoding.ASCII),
            [18] = Def(18, "Merchant Type (MCC)",                 IsoFieldType.Fixed,     4, IsoFieldEncoding.ASCII),
            [19] = Def(19, "Acquiring Institution Country Code",  IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [20] = Def(20, "PAN Extended, Country Code",          IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [21] = Def(21, "Forwarding Institution Country Code", IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [22] = Def(22, "POS Entry Mode",                      IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [23] = Def(23, "Card Sequence Number",                IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [24] = Def(24, "Network International ID",            IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII, "NII"),
            [25] = Def(25, "POS Condition Code",                  IsoFieldType.Fixed,     2, IsoFieldEncoding.ASCII),
            [26] = Def(26, "POS Capture Code",                    IsoFieldType.Fixed,     2, IsoFieldEncoding.ASCII),
            [27] = Def(27, "Authorizing ID Response Length",      IsoFieldType.Fixed,     1, IsoFieldEncoding.ASCII),
            [28] = Def(28, "Amount, Transaction Fee",             IsoFieldType.Fixed,     9, IsoFieldEncoding.ASCII),
            [29] = Def(29, "Amount, Settlement Fee",              IsoFieldType.Fixed,     9, IsoFieldEncoding.ASCII),
            [30] = Def(30, "Amount, Transaction Processing Fee",  IsoFieldType.Fixed,     9, IsoFieldEncoding.ASCII),
            [31] = Def(31, "Amount, Settlement Processing Fee",   IsoFieldType.Fixed,     9, IsoFieldEncoding.ASCII),
            [32] = Def(32, "Acquiring Institution ID Code",       IsoFieldType.LLVAR,    11, IsoFieldEncoding.ASCII),
            [33] = Def(33, "Forwarding Institution ID Code",      IsoFieldType.LLVAR,    11, IsoFieldEncoding.ASCII),
            [34] = Def(34, "PAN Extended",                        IsoFieldType.LLVAR,    28, IsoFieldEncoding.ASCII),
            [35] = Def(35, "Track 2 Data",                        IsoFieldType.LLVAR,    37, IsoFieldEncoding.ASCII),
            [36] = Def(36, "Track 3 Data",                        IsoFieldType.LLLVAR,  104, IsoFieldEncoding.ASCII),
            [37] = Def(37, "Retrieval Reference Number",          IsoFieldType.Fixed,    12, IsoFieldEncoding.ASCII),
            [38] = Def(38, "Authorization ID Response",           IsoFieldType.Fixed,     6, IsoFieldEncoding.ASCII),
            [39] = Def(39, "Response Code",                       IsoFieldType.Fixed,     2, IsoFieldEncoding.ASCII),
            [40] = Def(40, "Service Restriction Code",            IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [41] = Def(41, "Terminal ID",                         IsoFieldType.Fixed,     8, IsoFieldEncoding.ASCII),
            [42] = Def(42, "Merchant ID",                         IsoFieldType.Fixed,    15, IsoFieldEncoding.ASCII),
            [43] = Def(43, "Card Acceptor Name/Location",         IsoFieldType.Fixed,    40, IsoFieldEncoding.ASCII),
            [44] = Def(44, "Additional Response Data",            IsoFieldType.LLVAR,    25, IsoFieldEncoding.ASCII),
            [45] = Def(45, "Track 1 Data",                        IsoFieldType.LLVAR,    76, IsoFieldEncoding.ASCII),
            [46] = Def(46, "Additional Data – ISO",               IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [47] = Def(47, "Additional Data – National",          IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [48] = Def(48, "Additional Data – Private",           IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [49] = Def(49, "Currency Code, Transaction",          IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [50] = Def(50, "Currency Code, Settlement",           IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [51] = Def(51, "Currency Code, Cardholder Billing",   IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [52] = Def(52, "PIN Data",                            IsoFieldType.Fixed,     8, IsoFieldEncoding.Binary, "PIN Block"),
            [53] = Def(53, "Security Related Control Info",       IsoFieldType.Fixed,    18, IsoFieldEncoding.ASCII),
            [54] = Def(54, "Additional Amounts",                  IsoFieldType.LLLVAR,  120, IsoFieldEncoding.ASCII),
            [55] = Def(55, "ICC Data (EMV)",                      IsoFieldType.LLLVAR,  999, IsoFieldEncoding.Binary, "EMV"),
            [56] = Def(56, "Reserved ISO",                        IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [57] = Def(57, "Reserved National",                   IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [58] = Def(58, "Reserved National",                   IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [59] = Def(59, "Reserved National",                   IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [60] = Def(60, "Reserved Private",                    IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [61] = Def(61, "Reserved Private",                    IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [62] = Def(62, "Reserved Private",                    IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [63] = Def(63, "Reserved Private",                    IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [64] = Def(64, "Message Authentication Code (MAC)",   IsoFieldType.Fixed,     8, IsoFieldEncoding.Binary, "MAC"),

            // ── Secondary bitmap (bits 65–128) ──────────────────────────────

            [65] = Def(65,  "Bitmap, Extended",                    IsoFieldType.Fixed,     8, IsoFieldEncoding.Binary),
            [66] = Def(66,  "Settlement Code",                     IsoFieldType.Fixed,     1, IsoFieldEncoding.ASCII),
            [67] = Def(67,  "Extended Payment Code",               IsoFieldType.Fixed,     2, IsoFieldEncoding.ASCII),
            [68] = Def(68,  "Receiving Institution Country Code",  IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [69] = Def(69,  "Settlement Institution Country Code", IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [70] = Def(70,  "Network Management Information Code", IsoFieldType.Fixed,     3, IsoFieldEncoding.ASCII),
            [71] = Def(71,  "Message Number",                      IsoFieldType.Fixed,     4, IsoFieldEncoding.ASCII),
            [72] = Def(72,  "Message Number, Last",                IsoFieldType.Fixed,     4, IsoFieldEncoding.ASCII),
            [73] = Def(73,  "Date, Action",                        IsoFieldType.Fixed,     6, IsoFieldEncoding.ASCII),
            [74] = Def(74,  "Credits, Number",                     IsoFieldType.Fixed,    10, IsoFieldEncoding.ASCII),
            [75] = Def(75,  "Credits, Reversal Number",            IsoFieldType.Fixed,    10, IsoFieldEncoding.ASCII),
            [76] = Def(76,  "Debits, Number",                      IsoFieldType.Fixed,    10, IsoFieldEncoding.ASCII),
            [77] = Def(77,  "Debits, Reversal Number",             IsoFieldType.Fixed,    10, IsoFieldEncoding.ASCII),
            [78] = Def(78,  "Transfer, Number",                    IsoFieldType.Fixed,    10, IsoFieldEncoding.ASCII),
            [79] = Def(79,  "Transfer, Reversal Number",           IsoFieldType.Fixed,    10, IsoFieldEncoding.ASCII),
            [80] = Def(80,  "Inquiries, Number",                   IsoFieldType.Fixed,    10, IsoFieldEncoding.ASCII),
            [81] = Def(81,  "Authorizations, Number",              IsoFieldType.Fixed,    10, IsoFieldEncoding.ASCII),
            [82] = Def(82,  "Credits, Processing Fee Amount",      IsoFieldType.Fixed,    12, IsoFieldEncoding.ASCII),
            [83] = Def(83,  "Credits, Transaction Fee Amount",     IsoFieldType.Fixed,    12, IsoFieldEncoding.ASCII),
            [84] = Def(84,  "Debits, Processing Fee Amount",       IsoFieldType.Fixed,    12, IsoFieldEncoding.ASCII),
            [85] = Def(85,  "Debits, Transaction Fee Amount",      IsoFieldType.Fixed,    12, IsoFieldEncoding.ASCII),
            [86] = Def(86,  "Credits, Amount",                     IsoFieldType.Fixed,    16, IsoFieldEncoding.ASCII),
            [87] = Def(87,  "Credits, Reversal Amount",            IsoFieldType.Fixed,    16, IsoFieldEncoding.ASCII),
            [88] = Def(88,  "Debits, Amount",                      IsoFieldType.Fixed,    16, IsoFieldEncoding.ASCII),
            [89] = Def(89,  "Debits, Reversal Amount",             IsoFieldType.Fixed,    16, IsoFieldEncoding.ASCII),
            [90] = Def(90,  "Original Data Elements",              IsoFieldType.Fixed,    42, IsoFieldEncoding.ASCII),
            [91] = Def(91,  "File Update Code",                    IsoFieldType.Fixed,     1, IsoFieldEncoding.ASCII),
            [92] = Def(92,  "File Security Code",                  IsoFieldType.Fixed,     2, IsoFieldEncoding.ASCII),
            [93] = Def(93,  "Response Indicator",                  IsoFieldType.Fixed,     5, IsoFieldEncoding.ASCII),
            [94] = Def(94,  "Service Indicator",                   IsoFieldType.Fixed,     7, IsoFieldEncoding.ASCII),
            [95] = Def(95,  "Replacement Amounts",                 IsoFieldType.Fixed,    42, IsoFieldEncoding.ASCII),
            [96] = Def(96,  "Message Security Code",               IsoFieldType.Fixed,     8, IsoFieldEncoding.Binary),
            [97] = Def(97,  "Amount, Net Settlement",              IsoFieldType.Fixed,    17, IsoFieldEncoding.ASCII),
            [98] = Def(98,  "Payee",                               IsoFieldType.Fixed,    25, IsoFieldEncoding.ASCII),
            [99] = Def(99,  "Settlement Institution ID Code",      IsoFieldType.LLVAR,    11, IsoFieldEncoding.ASCII),
            [100] = Def(100, "Receiving Institution ID Code",      IsoFieldType.LLVAR,    11, IsoFieldEncoding.ASCII),
            [101] = Def(101, "File Name",                          IsoFieldType.LLVAR,    17, IsoFieldEncoding.ASCII),
            [102] = Def(102, "Account Identification 1",           IsoFieldType.LLVAR,    28, IsoFieldEncoding.ASCII),
            [103] = Def(103, "Account Identification 2",           IsoFieldType.LLVAR,    28, IsoFieldEncoding.ASCII),
            [104] = Def(104, "Transaction Description",            IsoFieldType.LLLVAR,  100, IsoFieldEncoding.ASCII),
            [105] = Def(105, "Reserved for ISO Use",               IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [106] = Def(106, "Reserved for ISO Use",               IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [107] = Def(107, "Reserved for ISO Use",               IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [108] = Def(108, "Reserved for ISO Use",               IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [109] = Def(109, "Reserved for ISO Use",               IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [110] = Def(110, "Reserved for ISO Use",               IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [111] = Def(111, "Reserved for ISO Use",               IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [112] = Def(112, "Reserved for National Use",          IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [113] = Def(113, "Reserved for National Use",          IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [114] = Def(114, "Reserved for National Use",          IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [115] = Def(115, "Reserved for National Use",          IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [116] = Def(116, "Reserved for National Use",          IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [117] = Def(117, "Reserved for National Use",          IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [118] = Def(118, "Reserved for National Use",          IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [119] = Def(119, "Reserved for National Use",          IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [120] = Def(120, "Reserved for Private Use",           IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [121] = Def(121, "Reserved for Private Use",           IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [122] = Def(122, "Reserved for Private Use",           IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [123] = Def(123, "Reserved for Private Use",           IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [124] = Def(124, "Reserved for Private Use",           IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [125] = Def(125, "Reserved for Private Use",           IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [126] = Def(126, "Reserved for Private Use",           IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [127] = Def(127, "Reserved for Private Use",           IsoFieldType.LLLVAR,  999, IsoFieldEncoding.ASCII),
            [128] = Def(128, "Message Authentication Code (MAC)",  IsoFieldType.Fixed,     8, IsoFieldEncoding.Binary, "MAC"),
        }
    };

    private static IsoFieldDefinition Def(
        int bit, string name, IsoFieldType type, int maxLen,
        IsoFieldEncoding enc, string? desc = null) =>
        new()
        {
            BitNumber   = bit,
            Name        = name,
            Type        = type,
            MaxLength   = maxLen,
            Encoding    = enc,
            Description = desc
        };
}
