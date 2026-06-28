namespace Iso8583Toolkit.Iso20022.Builder;

/// <summary>
/// Hard-coded catalogue of the ISO 20022 ecosystems we support and the
/// functional scenarios each one offers. Stateless, safe to keep as a
/// singleton; every method is an in-memory lookup.
/// </summary>
public sealed class ScenarioRegistry
{
    /// <summary>Wildcard prefix — matches every message type. Used by the generic scenario.</summary>
    public const string WildcardPrefix = "*";

    private readonly IReadOnlyList<EcosystemInfo> _ecosystems;
    private readonly IReadOnlyList<ScenarioDefinition> _scenarios;
    private readonly Dictionary<string, ScenarioDefinition> _byId;

    public ScenarioRegistry()
    {
        _ecosystems =
        [
            new("brazilian-pix", "Brazilian Pix", "Banco Central do Brasil - SPI"),
            new("sepa", "SEPA (EPC)", "European Payments Council"),
            new("swift-cbpr", "SWIFT CBPR+", "Cross-Border Payments and Reporting Plus"),
            new("target-t2", "TARGET / T2 (ECB)", "Eurosystem High-Value Payments"),
            new("generic", "Generic ISO 20022", "ISO 20022 standard fields only"),
        ];

        _scenarios = BuildScenarios();
        _byId = _scenarios.ToDictionary(s => s.ScenarioId, StringComparer.Ordinal);
    }

    public IReadOnlyList<EcosystemInfo> GetEcosystems() => _ecosystems;

    public IReadOnlyList<ScenarioDefinition> GetScenarios(string ecosystemId) =>
        _scenarios
            .Where(s => string.Equals(s.EcosystemId, ecosystemId, StringComparison.OrdinalIgnoreCase))
            .ToList();

    /// <summary>
    /// Filters scenarios within an ecosystem by the supplied message family
    /// prefix (e.g. <c>pacs.008</c>). The wildcard scenario(s) for that
    /// ecosystem always pass through.
    /// </summary>
    public IReadOnlyList<ScenarioDefinition> GetScenariosForMessageType(string ecosystemId, string messageTypePrefix)
    {
        var prefix = ExtractFamilyPrefix(messageTypePrefix);
        return _scenarios
            .Where(s => string.Equals(s.EcosystemId, ecosystemId, StringComparison.OrdinalIgnoreCase))
            .Where(s => s.MessageTypePrefix == WildcardPrefix
                        || string.Equals(s.MessageTypePrefix, prefix, StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    public ScenarioDefinition? GetScenario(string scenarioId) =>
        _byId.GetValueOrDefault(scenarioId);

    /// <summary>family+subId pair (e.g. <c>pacs.008</c>) from any messageType-shaped string.</summary>
    private static string ExtractFamilyPrefix(string messageTypeOrPrefix)
    {
        if (string.IsNullOrEmpty(messageTypeOrPrefix)) return messageTypeOrPrefix;
        var parts = messageTypeOrPrefix.Split('.');
        return parts.Length >= 2 ? $"{parts[0]}.{parts[1]}" : messageTypeOrPrefix;
    }

    private static IReadOnlyList<ScenarioDefinition> BuildScenarios()
    {
        // Empty collections reused across "no override / no hint" scenarios so
        // we don't allocate fresh empty dicts everywhere.
        var noOverrides = (IReadOnlyDictionary<string, string>)new Dictionary<string, string>();
        var noMandatory = (IReadOnlyList<string>)Array.Empty<string>();
        var noHints = (IReadOnlyDictionary<string, string>)new Dictionary<string, string>();

        return new ScenarioDefinition[]
        {
            // ── Brazilian Pix ─────────────────────────────────────────────────
            new(
                ScenarioId: "pix-credit-transfer",
                EcosystemId: "brazilian-pix",
                MessageTypePrefix: "pacs.008",
                DisplayName: "Credit Transfer (Pix)",
                Description: "Transferência interbancária via SPI",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FIToFICstmrCdtTrf/GrpHdr/MsgId"] = "PIX20240115BRADESCO0001",
                    ["FIToFICstmrCdtTrf/GrpHdr/NbOfTxs"] = "1",
                    // BCB Pix EndToEndId: "E" + ISPB(8) + AAAAMMDD(8) +
                    // HHMM(4) + sequencial(11) = 32 chars exactly.
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/PmtId/EndToEndId"]
                        = "E9999901020240115103058000000001",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/IntrBkSttlmAmt"] = "150.00",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/IntrBkSttlmAmt/@Ccy"] = "BRL",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/ChrgBr"] = "SLEV",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Nm"] = "João Silva",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Id/OrgId/Othr/Id"] = "12345678901",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAgt/FinInstnId/BICFI"] = "BRASBRRJXXX",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI"] = "ITAUBRSPXXX",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/Cdtr/Nm"] = "Maria Santos",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAcct/Id/Othr/Id"] = "maria@email.com",
                    ["FIToFICstmrCdtTrf/GrpHdr/SttlmInf/SttlmMtd"] = "CLRG",
                },
                // SPI/BCB tightens the XSD-optional rules: payer name + CPF,
                // both PSPs by ISPB-as-BIC, payee name + Pix key are all
                // required even though the underlying XSD lets them slide.
                AdditionalMandatoryXPaths: new[]
                {
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Nm",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Id/OrgId/Othr/Id",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAgt/FinInstnId/BICFI",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/Cdtr/Nm",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAcct/Id/Othr/Id",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FIToFICstmrCdtTrf/GrpHdr/MsgId"]
                        = "Pix: unique identifier per message, max 35 chars, alphanumeric",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/PmtId/EndToEndId"]
                        = "Pix: E2E ID must follow format Exxxxxxxxyyyymmddhhmmss[identifier]",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Id/OrgId/Othr/Id"]
                        = "Pix: CPF (11 dígitos) ou CNPJ (14 dígitos) do pagador",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAgt/FinInstnId/BICFI"]
                        = "Pix: ISPB do PSP pagador em formato BIC (ex: BRASBRRJXXX = Bradesco)",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI"]
                        = "Pix: ISPB do PSP recebedor em formato BIC (ex: ITAUBRSPXXX = Itaú)",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAcct/Id/Othr/Id"]
                        = "Pix: chave do recebedor — CPF, CNPJ, email, telefone (+55...) ou EVP (UUID)",
                }),

            new(
                ScenarioId: "pix-return",
                EcosystemId: "brazilian-pix",
                MessageTypePrefix: "pacs.004",
                DisplayName: "Payment Return (Pix)",
                Description: "Devolução de transferência Pix via SPI",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["PmtRtr/GrpHdr/MsgId"] = "9999901020240115000001",
                    ["PmtRtr/GrpHdr/NbOfTxs"] = "1",
                    ["PmtRtr/GrpHdr/SttlmInf/SttlmMtd"] = "CLRG",
                    ["PmtRtr/TxInf/RtrId"] = "E9999901020240115103058000000002",
                    ["PmtRtr/TxInf/OrgnlEndToEndId"] = "E9999901020240115103058000000001",
                    ["PmtRtr/TxInf/OrgnlTxId"] = "TX-ORIGINAL-001",
                    ["PmtRtr/TxInf/RtrdIntrBkSttlmAmt"] = "150.00",
                    ["PmtRtr/TxInf/RtrdIntrBkSttlmAmt/@Ccy"] = "BRL",
                    ["PmtRtr/TxInf/RtrRsnInf/Rsn/Cd"] = "FOCR",
                    ["PmtRtr/TxInf/RtrRsnInf/AddtlInf"] = "Devolucao solicitada pelo pagador",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "PmtRtr/TxInf/RtrId",
                    "PmtRtr/TxInf/OrgnlEndToEndId",
                    "PmtRtr/TxInf/RtrdIntrBkSttlmAmt",
                    "PmtRtr/TxInf/RtrRsnInf/Rsn/Cd",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["PmtRtr/TxInf/RtrRsnInf/Rsn/Cd"]
                        = "Pix: FOCR=solicitado pelo pagador, FRAD=fraude, AC04=conta encerrada",
                    ["PmtRtr/TxInf/OrgnlEndToEndId"]
                        = "Pix: EndToEndId da pacs.008 original que está sendo devolvida",
                }),

            new(
                ScenarioId: "pix-status-report",
                EcosystemId: "brazilian-pix",
                MessageTypePrefix: "pacs.002",
                DisplayName: "Payment Status Report (Pix)",
                Description: "Confirmação ou rejeição de transferência Pix",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FIToFIPmtStsRpt/GrpHdr/MsgId"] = "9999901020240115000002",
                    ["FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgId"] = "9999901020240115000001",
                    ["FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgNmId"] = "pacs.008.001.13",
                    ["FIToFIPmtStsRpt/TxInfAndSts/OrgnlEndToEndId"]
                        = "E9999901020240115103058000000001",
                    ["FIToFIPmtStsRpt/TxInfAndSts/OrgnlTxId"] = "TX-ORIGINAL-001",
                    ["FIToFIPmtStsRpt/TxInfAndSts/TxSts"] = "ACCP",
                    ["FIToFIPmtStsRpt/TxInfAndSts/AccptncDtTm"] = "2024-01-15T10:30:01",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgId",
                    "FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgNmId",
                    "FIToFIPmtStsRpt/TxInfAndSts/OrgnlEndToEndId",
                    "FIToFIPmtStsRpt/TxInfAndSts/TxSts",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FIToFIPmtStsRpt/TxInfAndSts/TxSts"]
                        = "Pix: ACCP=aceito, RJCT=rejeitado, PDNG=pendente, ACSC=liquidado",
                }),

            new(
                ScenarioId: "pix-initiation",
                EcosystemId: "brazilian-pix",
                MessageTypePrefix: "pain.001",
                DisplayName: "Payment Initiation (Open Finance)",
                Description: "Iniciação de pagamento via Open Finance/Pix",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["CstmrCdtTrfInitn/GrpHdr/MsgId"] = "9999901020240115000003",
                    ["CstmrCdtTrfInitn/GrpHdr/NbOfTxs"] = "1",
                    ["CstmrCdtTrfInitn/GrpHdr/CtrlSum"] = "150.00",
                    ["CstmrCdtTrfInitn/GrpHdr/InitgPty/Nm"] = "João Silva",
                    ["CstmrCdtTrfInitn/PmtInf/PmtInfId"] = "PMTINF-20240115-001",
                    ["CstmrCdtTrfInitn/PmtInf/PmtMtd"] = "TRF",
                    ["CstmrCdtTrfInitn/PmtInf/ReqdExctnDt/Dt"] = "2024-01-15",
                    ["CstmrCdtTrfInitn/PmtInf/Dbtr/Nm"] = "João Silva",
                    ["CstmrCdtTrfInitn/PmtInf/Dbtr/Id/PrvtId/Othr/Id"] = "12345678901",
                    ["CstmrCdtTrfInitn/PmtInf/DbtrAcct/Id/Othr/Id"] = "conta-pagador-001",
                    ["CstmrCdtTrfInitn/PmtInf/DbtrAcct/Id/Othr/SchmeNm/Cd"] = "BBAN",
                    ["CstmrCdtTrfInitn/PmtInf/DbtrAgt/FinInstnId/BICFI"] = "BRASBRRJXXX",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/PmtId/EndToEndId"]
                        = "E9999901020240115103058000000001",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/Amt/InstdAmt"] = "150.00",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/Amt/InstdAmt/@Ccy"] = "BRL",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI"]
                        = "ITAUBRSPXXX",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/Cdtr/Nm"] = "Maria Santos",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/CdtrAcct/Id/Othr/Id"]
                        = "maria@email.com",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "CstmrCdtTrfInitn/GrpHdr/InitgPty/Nm",
                    "CstmrCdtTrfInitn/PmtInf/Dbtr/Nm",
                    "CstmrCdtTrfInitn/PmtInf/DbtrAcct/Id/Othr/Id",
                    "CstmrCdtTrfInitn/PmtInf/DbtrAgt/FinInstnId/BICFI",
                    "CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI",
                    "CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/Cdtr/Nm",
                    "CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/CdtrAcct/Id/Othr/Id",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["CstmrCdtTrfInitn/PmtInf/PmtMtd"]
                        = "Open Finance/Pix: sempre TRF (transferência)",
                    ["CstmrCdtTrfInitn/PmtInf/DbtrAcct/Id/Othr/Id"]
                        = "Pix: número da conta do pagador no PSP pagador",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/CdtrAcct/Id/Othr/Id"]
                        = "Pix: chave do recebedor — email, CPF, CNPJ, telefone (+55...) ou EVP",
                }),

            new(
                ScenarioId: "pix-credit-notification",
                EcosystemId: "brazilian-pix",
                MessageTypePrefix: "camt.054",
                DisplayName: "Credit/Debit Notification (Pix)",
                Description: "Notificação de lançamento Pix recebido pelo PSP recebedor",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["BkToCstmrDbtCdtNtfctn/GrpHdr/MsgId"] = "9999901020240115000004",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Id"] = "NTFCTN-20240115-001",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Acct/Id/Othr/Id"] = "conta-recebedor-001",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/Amt"] = "150.00",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/Amt/@Ccy"] = "BRL",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/CdtDbtInd"] = "CRDT",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/Sts/Cd"] = "BOOK",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/BookgDt/DtTm"] = "2024-01-15T10:30:01",
                    // BkTxCd is XSD-mandatory inside Ntry; the codes are the
                    // SPI-recommended values for received Pix credit entries.
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/BkTxCd/Domn/Cd"] = "PMNT",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/BkTxCd/Domn/Fmly/Cd"] = "RCDT",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/BkTxCd/Domn/Fmly/SubFmlyCd"] = "ESCT",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/NtryDtls/TxDtls/Refs/EndToEndId"]
                        = "E9999901020240115103058000000001",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "BkToCstmrDbtCdtNtfctn/Ntfctn/Id",
                    "BkToCstmrDbtCdtNtfctn/Ntfctn/Acct/Id/Othr/Id",
                    "BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/Amt",
                    "BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/CdtDbtInd",
                    "BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/Sts/Cd",
                    "BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/BookgDt/DtTm",
                    "BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/BkTxCd/Domn/Cd",
                    "BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/BkTxCd/Domn/Fmly/Cd",
                    "BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/BkTxCd/Domn/Fmly/SubFmlyCd",
                    // Pix flow needs the original EndToEndId echoed back
                    // here to tie the credit notification to the pacs.008
                    // that produced it.
                    "BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/NtryDtls/TxDtls/Refs/EndToEndId",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/CdtDbtInd"]
                        = "Pix recebido: CRDT. Pix debitado: DBIT",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/BkTxCd/Domn/Cd"]
                        = "Pix: PMNT = domínio de pagamentos",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/BkTxCd/Domn/Fmly/Cd"]
                        = "Pix recebido: RCDT (received credit transfer). Pix debitado: ICDT",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/BkTxCd/Domn/Fmly/SubFmlyCd"]
                        = "Pix: ESCT = electronic credit transfer",
                    ["BkToCstmrDbtCdtNtfctn/Ntfctn/Ntry/NtryDtls/TxDtls/Refs/EndToEndId"]
                        = "Pix: mesmo EndToEndId da pacs.008 original",
                }),

            // ── SEPA (EPC) ────────────────────────────────────────────────────
            new(
                ScenarioId: "sepa-credit-transfer",
                EcosystemId: "sepa",
                MessageTypePrefix: "pacs.008",
                DisplayName: "SEPA Credit Transfer (SCT)",
                Description: "SEPA Credit Transfer - EPC Rulebook",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FIToFICstmrCdtTrf/GrpHdr/MsgId"] = "SEPA20240115BNPPARIBAS001",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/PmtId/EndToEndId"] = "INV-2024-00142",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/IntrBkSttlmAmt"] = "1000.00",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/IntrBkSttlmAmt/@Ccy"] = "EUR",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/ChrgBr"] = "SLEV",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Nm"] = "Acme GmbH",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAcct/Id/IBAN"] = "DE89370400440532013000",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAgt/FinInstnId/BICFI"] = "BNPAFRPPXXX",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI"] = "DEUTDEDBXXX",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/Cdtr/Nm"] = "Schmidt AG",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAcct/Id/IBAN"] = "DE75512108001245126199",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/RmtInf/Ustrd"] = "INV-2024-00142",
                    ["FIToFICstmrCdtTrf/GrpHdr/SttlmInf/SttlmMtd"] = "CLRG",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Nm",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAcct/Id/IBAN",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAgt/FinInstnId/BICFI",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/Cdtr/Nm",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAcct/Id/IBAN",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/PmtId/EndToEndId"]
                        = "SEPA: max 35 chars, Latin charset only (no special characters)",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAcct/Id/IBAN"]
                        = "SEPA: IBAN obrigatório para conta do pagador",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAcct/Id/IBAN"]
                        = "SEPA: IBAN obrigatório para conta do recebedor",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/RmtInf/Ustrd"]
                        = "SEPA: informação de remessa, max 140 chars, charset latino",
                }),

            new(
                ScenarioId: "sepa-status-report",
                EcosystemId: "sepa",
                MessageTypePrefix: "pacs.002",
                DisplayName: "Payment Status Report (SEPA)",
                Description: "Status report SEPA SCT",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FIToFIPmtStsRpt/GrpHdr/MsgId"] = "MSG-20240115-A3F12B",
                    ["FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgId"] = "SEPA20240115BNPPARIBAS001",
                    ["FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgNmId"] = "pacs.008.001.13",
                    ["FIToFIPmtStsRpt/TxInfAndSts/TxSts"] = "ACCP",
                    ["FIToFIPmtStsRpt/TxInfAndSts/OrgnlEndToEndId"] = "INV-2024-00142",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgId",
                    "FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgNmId",
                    "FIToFIPmtStsRpt/TxInfAndSts/TxSts",
                    "FIToFIPmtStsRpt/TxInfAndSts/OrgnlEndToEndId",
                },
                FieldHints: noHints),

            new(
                ScenarioId: "sepa-initiation",
                EcosystemId: "sepa",
                MessageTypePrefix: "pain.001",
                DisplayName: "Credit Transfer Initiation (SEPA)",
                Description: "Iniciação de transferência SEPA SCT pelo cliente",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["CstmrCdtTrfInitn/GrpHdr/MsgId"] = "SEPA20240115A3F12B",
                    ["CstmrCdtTrfInitn/GrpHdr/NbOfTxs"] = "1",
                    ["CstmrCdtTrfInitn/GrpHdr/CtrlSum"] = "1000.00",
                    ["CstmrCdtTrfInitn/GrpHdr/InitgPty/Nm"] = "Acme GmbH",
                    ["CstmrCdtTrfInitn/PmtInf/PmtInfId"] = "PMTINF-SEPA-001",
                    ["CstmrCdtTrfInitn/PmtInf/PmtMtd"] = "TRF",
                    ["CstmrCdtTrfInitn/PmtInf/ReqdExctnDt/Dt"] = "2024-01-16",
                    ["CstmrCdtTrfInitn/PmtInf/Dbtr/Nm"] = "Acme GmbH",
                    ["CstmrCdtTrfInitn/PmtInf/DbtrAcct/Id/IBAN"] = "DE89370400440532013000",
                    ["CstmrCdtTrfInitn/PmtInf/DbtrAgt/FinInstnId/BICFI"] = "BNPAFRPPXXX",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/PmtId/EndToEndId"] = "INV-2024-00142",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/Amt/InstdAmt"] = "1000.00",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/Amt/InstdAmt/@Ccy"] = "EUR",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI"]
                        = "DEUTDEDBXXX",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/Cdtr/Nm"] = "Schmidt AG",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/CdtrAcct/Id/IBAN"]
                        = "DE75512108001245126199",
                    ["CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/RmtInf/Ustrd"] = "INV-2024-00142",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "CstmrCdtTrfInitn/GrpHdr/InitgPty/Nm",
                    "CstmrCdtTrfInitn/PmtInf/Dbtr/Nm",
                    "CstmrCdtTrfInitn/PmtInf/DbtrAcct/Id/IBAN",
                    "CstmrCdtTrfInitn/PmtInf/DbtrAgt/FinInstnId/BICFI",
                    "CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI",
                    "CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/Cdtr/Nm",
                    "CstmrCdtTrfInitn/PmtInf/CdtTrfTxInf/CdtrAcct/Id/IBAN",
                },
                FieldHints: noHints),

            new(
                ScenarioId: "sepa-return",
                EcosystemId: "sepa",
                MessageTypePrefix: "pacs.004",
                DisplayName: "Payment Return (SEPA SCT Recall)",
                Description: "Devolução/recall de transferência SEPA",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["PmtRtr/GrpHdr/MsgId"] = "SEPA20240115A3F12B",
                    ["PmtRtr/GrpHdr/NbOfTxs"] = "1",
                    ["PmtRtr/GrpHdr/SttlmInf/SttlmMtd"] = "CLRG",
                    ["PmtRtr/TxInf/OrgnlEndToEndId"] = "INV-2024-00142",
                    ["PmtRtr/TxInf/RtrdIntrBkSttlmAmt"] = "1000.00",
                    ["PmtRtr/TxInf/RtrdIntrBkSttlmAmt/@Ccy"] = "EUR",
                    ["PmtRtr/TxInf/RtrRsnInf/Rsn/Cd"] = "AC04",
                    ["PmtRtr/TxInf/RtrRsnInf/AddtlInf"] = "Account closed",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "PmtRtr/TxInf/OrgnlEndToEndId",
                    "PmtRtr/TxInf/RtrdIntrBkSttlmAmt",
                    "PmtRtr/TxInf/RtrRsnInf/Rsn/Cd",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["PmtRtr/TxInf/RtrRsnInf/Rsn/Cd"]
                        = "SEPA: AC04=conta encerrada, AM05=duplicata, CUST=solicitado pelo cliente",
                }),

            // ── SWIFT CBPR+ ───────────────────────────────────────────────────
            new(
                ScenarioId: "cbpr-direct-payment",
                EcosystemId: "swift-cbpr",
                MessageTypePrefix: "pacs.008",
                DisplayName: "Direct Payment (CBPR+)",
                Description: "FI-to-FI Customer Credit Transfer - SWIFT FINplus",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FIToFICstmrCdtTrf/GrpHdr/MsgId"] = "CHASUS33XXX20240115001",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/PmtId/EndToEndId"] = "WIRE-2024-00001",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/PmtId/UETR"]
                        = "550e8400-e29b-41d4-a716-446655440000",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/IntrBkSttlmAmt"] = "75000.00",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/IntrBkSttlmAmt/@Ccy"] = "USD",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/ChrgBr"] = "DEBT",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Nm"] = "Acme Corporation",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAgt/FinInstnId/BICFI"] = "CHASUS33XXX",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI"] = "HSBCGB2LXXX",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/Cdtr/Nm"] = "Global Trading Ltd",
                    ["FIToFICstmrCdtTrf/GrpHdr/SttlmInf/SttlmMtd"] = "INDA",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/PmtId/UETR",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Nm",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAgt/FinInstnId/BICFI",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/Cdtr/Nm",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/PmtId/UETR"]
                        = "CBPR+: UETR is mandatory, must be a valid UUID v4, unique per payment",
                    ["FIToFICstmrCdtTrf/GrpHdr/MsgId"]
                        = "CBPR+: MsgId must be unique for 90 days",
                }),

            new(
                ScenarioId: "cbpr-cover-payment",
                EcosystemId: "swift-cbpr",
                MessageTypePrefix: "pacs.009",
                DisplayName: "Cover Payment (CBPR+)",
                Description: "Financial Institution Credit Transfer - cover method",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FICdtTrf/CdtTrfTxInf/IntrBkSttlmAmt"] = "75000.00",
                    ["FICdtTrf/CdtTrfTxInf/IntrBkSttlmAmt/@Ccy"] = "USD",
                    ["FICdtTrf/CdtTrfTxInf/Dbtr/FinInstnId/BICFI"] = "CHASUS33XXX",
                    ["FICdtTrf/CdtTrfTxInf/Cdtr/FinInstnId/BICFI"] = "HSBCGB2LXXX",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FICdtTrf/CdtTrfTxInf/PmtId/UETR",
                    "FICdtTrf/CdtTrfTxInf/Dbtr/FinInstnId/BICFI",
                    "FICdtTrf/CdtTrfTxInf/Cdtr/FinInstnId/BICFI",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FICdtTrf/CdtTrfTxInf/PmtId/UETR"]
                        = "CBPR+: UETR must match the underlying pacs.008",
                }),

            new(
                ScenarioId: "cbpr-return",
                EcosystemId: "swift-cbpr",
                MessageTypePrefix: "pacs.004",
                DisplayName: "Payment Return (CBPR+)",
                Description: "Return of funds - CBPR+ best practice",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["PmtRtr/GrpHdr/SttlmInf/SttlmMtd"] = "INDA",
                    ["PmtRtr/TxInf/OrgnlEndToEndId"] = "WIRE-2024-00001",
                    ["PmtRtr/TxInf/RtrdIntrBkSttlmAmt"] = "75000.00",
                    ["PmtRtr/TxInf/RtrdIntrBkSttlmAmt/@Ccy"] = "USD",
                    ["PmtRtr/TxInf/RtrRsnInf/Rsn/Cd"] = "AC04",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "PmtRtr/TxInf/OrgnlEndToEndId",
                    "PmtRtr/TxInf/RtrdIntrBkSttlmAmt",
                    "PmtRtr/TxInf/RtrRsnInf/Rsn/Cd",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["PmtRtr/TxInf/RtrRsnInf/Rsn/Cd"]
                        = "CBPR+: AC04=conta encerrada, AM05=duplicata, NARR=narrativa livre",
                }),

            new(
                ScenarioId: "cbpr-status-report",
                EcosystemId: "swift-cbpr",
                MessageTypePrefix: "pacs.002",
                DisplayName: "Payment Status Report (CBPR+)",
                Description: "FI-to-FI Payment Status Report",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FIToFIPmtStsRpt/GrpHdr/MsgId"] = "CBPR20240115A3F12B",
                    ["FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgId"] = "CHASUS33XXX20240115001",
                    ["FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgNmId"] = "pacs.008.001.13",
                    ["FIToFIPmtStsRpt/TxInfAndSts/TxSts"] = "ACCP",
                    ["FIToFIPmtStsRpt/TxInfAndSts/OrgnlEndToEndId"] = "WIRE-2024-00001",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgId",
                    "FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgNmId",
                    "FIToFIPmtStsRpt/TxInfAndSts/TxSts",
                    "FIToFIPmtStsRpt/TxInfAndSts/OrgnlEndToEndId",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FIToFIPmtStsRpt/TxInfAndSts/TxSts"]
                        = "CBPR+: negative pacs.002 (RJCT) is mandatory; positive is bilateral",
                }),

            new(
                ScenarioId: "cbpr-status-request",
                EcosystemId: "swift-cbpr",
                MessageTypePrefix: "pacs.028",
                DisplayName: "Payment Status Request (CBPR+)",
                Description: "Consulta de status de pagamento pendente - SWIFT FINplus",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FIToFIPmtStsReq/GrpHdr/MsgId"] = "CBPR20240115A3F12B",
                    ["FIToFIPmtStsReq/GrpHdr/CreDtTm"] = "2024-01-15T10:30:00",
                    ["FIToFIPmtStsReq/OrgnlGrpInf/OrgnlMsgId"] = "CHASUS33XXX20240115001",
                    ["FIToFIPmtStsReq/OrgnlGrpInf/OrgnlMsgNmId"] = "pacs.008.001.13",
                    ["FIToFIPmtStsReq/TxInf/OrgnlEndToEndId"] = "WIRE-2024-00001",
                    ["FIToFIPmtStsReq/TxInf/OrgnlUETR"]
                        = "550e8400-e29b-41d4-a716-446655440000",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FIToFIPmtStsReq/OrgnlGrpInf/OrgnlMsgId",
                    "FIToFIPmtStsReq/OrgnlGrpInf/OrgnlMsgNmId",
                    "FIToFIPmtStsReq/TxInf/OrgnlEndToEndId",
                    "FIToFIPmtStsReq/TxInf/OrgnlUETR",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FIToFIPmtStsReq/TxInf/OrgnlUETR"]
                        = "CBPR+: UETR da pacs.008 original sendo consultada",
                }),

            new(
                ScenarioId: "cbpr-cancellation",
                EcosystemId: "swift-cbpr",
                MessageTypePrefix: "camt.056",
                DisplayName: "Payment Cancellation Request (CBPR+)",
                Description: "Solicitação de cancelamento de pagamento - SWIFT FINplus",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FIToFIPmtCxlReq/Assgnmt/MsgId"] = "CBPR20240115A3F12B",
                    ["FIToFIPmtCxlReq/Assgnmt/CreDtTm"] = "2024-01-15T10:30:00",
                    ["FIToFIPmtCxlReq/Assgnmt/Assgnr/Agt/FinInstnId/BICFI"] = "CHASUS33XXX",
                    ["FIToFIPmtCxlReq/Assgnmt/Assgne/Agt/FinInstnId/BICFI"] = "HSBCGB2LXXX",
                    ["FIToFIPmtCxlReq/Undrlyg/TxInf/OrgnlEndToEndId"] = "WIRE-2024-00001",
                    ["FIToFIPmtCxlReq/Undrlyg/TxInf/OrgnlUETR"]
                        = "550e8400-e29b-41d4-a716-446655440000",
                    ["FIToFIPmtCxlReq/Undrlyg/TxInf/CxlRsnInf/Rsn/Cd"] = "DUPL",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FIToFIPmtCxlReq/Assgnmt/Assgnr/Agt/FinInstnId/BICFI",
                    "FIToFIPmtCxlReq/Assgnmt/Assgne/Agt/FinInstnId/BICFI",
                    "FIToFIPmtCxlReq/Undrlyg/TxInf/OrgnlEndToEndId",
                    "FIToFIPmtCxlReq/Undrlyg/TxInf/CxlRsnInf/Rsn/Cd",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FIToFIPmtCxlReq/Undrlyg/TxInf/CxlRsnInf/Rsn/Cd"]
                        = "CBPR+: DUPL=duplicata, FRAD=fraude, TECH=erro técnico, CUST=solicitado pelo cliente",
                    ["FIToFIPmtCxlReq/Undrlyg/TxInf/OrgnlUETR"]
                        = "CBPR+: UETR da pacs.008 que se deseja cancelar",
                }),

            // ── TARGET / T2 (ECB) ─────────────────────────────────────────────
            new(
                ScenarioId: "t2-credit-transfer",
                EcosystemId: "target-t2",
                MessageTypePrefix: "pacs.008",
                DisplayName: "High Value Credit Transfer (T2)",
                Description: "TARGET2/T2 - Eurosystem RTGS",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FIToFICstmrCdtTrf/GrpHdr/MsgId"] = "DEUTDEDBXXX20240115HVP001",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/PmtId/EndToEndId"] = "T2-HVP-20240115-001",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/IntrBkSttlmAmt"] = "500000.00",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/IntrBkSttlmAmt/@Ccy"] = "EUR",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/ChrgBr"] = "DEBT",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Nm"] = "Deutsche Bank AG",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAgt/FinInstnId/BICFI"] = "DEUTDEDBXXX",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI"] = "SOGEFRPPXXX",
                    ["FIToFICstmrCdtTrf/CdtTrfTxInf/Cdtr/Nm"] = "Société Générale SA",
                    ["FIToFICstmrCdtTrf/GrpHdr/SttlmInf/SttlmMtd"] = "INDA",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/Dbtr/Nm",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/DbtrAgt/FinInstnId/BICFI",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI",
                    "FIToFICstmrCdtTrf/CdtTrfTxInf/Cdtr/Nm",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FIToFICstmrCdtTrf/GrpHdr/MsgId"]
                        = "T2: MsgId format recommended: BIC11+date+sequence",
                }),

            new(
                ScenarioId: "t2-fi-transfer",
                EcosystemId: "target-t2",
                MessageTypePrefix: "pacs.009",
                DisplayName: "FI Credit Transfer (T2)",
                Description: "Financial Institution Credit Transfer - T2",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FICdtTrf/CdtTrfTxInf/IntrBkSttlmAmt"] = "500000.00",
                    ["FICdtTrf/CdtTrfTxInf/IntrBkSttlmAmt/@Ccy"] = "EUR",
                    ["FICdtTrf/CdtTrfTxInf/Dbtr/FinInstnId/BICFI"] = "DEUTDEDBXXX",
                    ["FICdtTrf/CdtTrfTxInf/Cdtr/FinInstnId/BICFI"] = "SOGEFRPPXXX",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FICdtTrf/CdtTrfTxInf/Dbtr/FinInstnId/BICFI",
                    "FICdtTrf/CdtTrfTxInf/Cdtr/FinInstnId/BICFI",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FICdtTrf/CdtTrfTxInf/IntrBkSttlmAmt"]
                        = "T2: opera em EUR, moeda obrigatória para liquidação no Eurosistema",
                }),

            new(
                ScenarioId: "t2-cancellation",
                EcosystemId: "target-t2",
                MessageTypePrefix: "camt.056",
                DisplayName: "Payment Cancellation Request (T2)",
                Description: "Solicitação de cancelamento de pagamento no TARGET/T2",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FIToFIPmtCxlReq/Assgnmt/MsgId"] = "DEUTDEDBXXX20240115001",
                    ["FIToFIPmtCxlReq/Assgnmt/CreDtTm"] = "2024-01-15T10:30:00",
                    ["FIToFIPmtCxlReq/Assgnmt/Assgnr/Agt/FinInstnId/BICFI"] = "DEUTDEDBXXX",
                    ["FIToFIPmtCxlReq/Assgnmt/Assgne/Agt/FinInstnId/BICFI"] = "TRGTXE2XXXX",
                    ["FIToFIPmtCxlReq/Undrlyg/TxInf/OrgnlEndToEndId"] = "T2-HVP-20240115-001",
                    ["FIToFIPmtCxlReq/Undrlyg/TxInf/CxlRsnInf/Rsn/Cd"] = "TECH",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FIToFIPmtCxlReq/Assgnmt/Assgnr/Agt/FinInstnId/BICFI",
                    "FIToFIPmtCxlReq/Assgnmt/Assgne/Agt/FinInstnId/BICFI",
                    "FIToFIPmtCxlReq/Undrlyg/TxInf/OrgnlEndToEndId",
                    "FIToFIPmtCxlReq/Undrlyg/TxInf/CxlRsnInf/Rsn/Cd",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FIToFIPmtCxlReq/Assgnmt/Assgne/Agt/FinInstnId/BICFI"]
                        = "T2: BIC do Eurosistema/BCE — TRGTXE2XXXX para TARGET",
                    ["FIToFIPmtCxlReq/Undrlyg/TxInf/CxlRsnInf/Rsn/Cd"]
                        = "T2: TECH=erro técnico, DUPL=duplicata, FRAD=fraude",
                }),

            // ── Generic ISO 20022 ─────────────────────────────────────────────
            // The wildcard generic is the fallback for any message type the
            // user picks. The prefix-specific generic-* scenarios below add
            // recommended fields that aren't XSD-mandatory but are essential
            // for a usable message — only routed when the message family
            // matches.
            new(
                ScenarioId: "generic-pacs002",
                EcosystemId: "generic",
                MessageTypePrefix: "pacs.002",
                DisplayName: "Payment Status Report (Generic)",
                Description: "XSD-mandatory fields plus recommended status references",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["FIToFIPmtStsRpt/GrpHdr/MsgId"] = "MSG-20240115-A3F12B",
                    ["FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgId"] = "ORIGINAL-MSG-ID",
                    ["FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgNmId"] = "pacs.008.001.13",
                    ["FIToFIPmtStsRpt/TxInfAndSts/OrgnlEndToEndId"] = "ORIGINAL-E2E-ID",
                    ["FIToFIPmtStsRpt/TxInfAndSts/TxSts"] = "ACCP",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgId",
                    "FIToFIPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgNmId",
                    "FIToFIPmtStsRpt/TxInfAndSts/OrgnlEndToEndId",
                    "FIToFIPmtStsRpt/TxInfAndSts/TxSts",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["FIToFIPmtStsRpt/TxInfAndSts/TxSts"]
                        = "ACCP=accepted, RJCT=rejected, PDNG=pending, ACSC=settled",
                }),

            new(
                ScenarioId: "generic-pain002",
                EcosystemId: "generic",
                MessageTypePrefix: "pain.002",
                DisplayName: "Payment Status Report Customer (Generic)",
                Description: "XSD-mandatory fields plus recommended status references",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["CstmrPmtStsRpt/GrpHdr/MsgId"] = "MSG-20240115-A3F12B",
                    ["CstmrPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgId"] = "ORIGINAL-MSG-ID",
                    ["CstmrPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgNmId"] = "pain.001.001.12",
                    ["CstmrPmtStsRpt/OrgnlGrpInfAndSts/GrpSts"] = "ACCP",
                    ["CstmrPmtStsRpt/OrgnlPmtInfAndSts/OrgnlPmtInfId"] = "ORIGINAL-PMTINF-ID",
                    ["CstmrPmtStsRpt/OrgnlPmtInfAndSts/PmtInfSts"] = "ACCP",
                    ["CstmrPmtStsRpt/OrgnlPmtInfAndSts/TxInfAndSts/OrgnlEndToEndId"]
                        = "ORIGINAL-E2E-ID",
                    ["CstmrPmtStsRpt/OrgnlPmtInfAndSts/TxInfAndSts/TxSts"] = "ACCP",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "CstmrPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgId",
                    "CstmrPmtStsRpt/OrgnlGrpInfAndSts/OrgnlMsgNmId",
                    "CstmrPmtStsRpt/OrgnlGrpInfAndSts/GrpSts",
                    "CstmrPmtStsRpt/OrgnlPmtInfAndSts/TxInfAndSts/TxSts",
                },
                FieldHints: noHints),

            new(
                ScenarioId: "generic-pacs004",
                EcosystemId: "generic",
                MessageTypePrefix: "pacs.004",
                DisplayName: "Payment Return (Generic)",
                Description: "XSD-mandatory fields plus recommended return references",
                FieldOverrides: new Dictionary<string, string>
                {
                    ["PmtRtr/GrpHdr/MsgId"] = "RET-20240115-A3F12B",
                    ["PmtRtr/GrpHdr/NbOfTxs"] = "1",
                    ["PmtRtr/TxInf/OrgnlEndToEndId"] = "ORIGINAL-E2E-ID",
                    ["PmtRtr/TxInf/RtrdIntrBkSttlmAmt"] = "0.00",
                    ["PmtRtr/TxInf/RtrdIntrBkSttlmAmt/@Ccy"] = "USD",
                    ["PmtRtr/TxInf/RtrRsnInf/Rsn/Cd"] = "FOCR",
                },
                AdditionalMandatoryXPaths: new[]
                {
                    "PmtRtr/TxInf/OrgnlEndToEndId",
                    "PmtRtr/TxInf/RtrdIntrBkSttlmAmt",
                    "PmtRtr/TxInf/RtrRsnInf/Rsn/Cd",
                },
                FieldHints: new Dictionary<string, string>
                {
                    ["PmtRtr/TxInf/RtrRsnInf/Rsn/Cd"]
                        = "Common codes: FOCR=requested by originator, AC04=closed account, AM05=duplicate",
                }),

            // Wildcard fallback — every messageType without a more specific
            // generic-* match uses this one.
            new(
                ScenarioId: "generic",
                EcosystemId: "generic",
                MessageTypePrefix: WildcardPrefix,
                DisplayName: "Minimal valid message",
                Description: "Fields based on XSD only, no ecosystem rules",
                FieldOverrides: noOverrides,
                AdditionalMandatoryXPaths: noMandatory,
                FieldHints: noHints),
        };
    }
}
