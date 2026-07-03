namespace Iso8583Toolkit.Iso20022.Swift.Mt;

/// <summary>
/// Tag-by-tag MT field catalogue used by <see cref="MtParserService"/>
/// to attach a human description and MX equivalent to every parsed
/// field. Sources: SWIFT CBPR+ Usage Guidelines (MyStandards),
/// J.P. Morgan ISO 20022 Mapping Guide, SWIFT ISO 20022 Community
/// Readiness Deck (Dec 2024), PMPG Cover Payments Market Practice
/// Guidelines v4.0 (Feb 2024).
///
/// Header pseudo-tags ("Block1", "Block2", "Block3_121") describe the
/// synthetic fields the parser emits for the SWIFT envelope blocks.
/// </summary>
public static class MtFieldDictionary
{
    public static readonly IReadOnlyDictionary<string, MtFieldMeta> Entries =
        new Dictionary<string, MtFieldMeta>(StringComparer.OrdinalIgnoreCase)
        {
            // ── Common tags (MT103, MT202, MT202COV) ──────────────────
            ["20"] = new(
                Name: "Transaction Reference Number",
                Description: "Referência única atribuída pelo remetente para identificar "
                    + "a mensagem. Deve ser único por remetente.",
                Format: "até 16 caracteres alfanuméricos",
                MxPath: "PmtId/InstrId"),

            ["23B"] = new(
                Name: "Bank Operation Code",
                Description: "Tipo de operação bancária. CRED = customer credit transfer "
                    + "(mais comum). Determina como o banco processa o pagamento.",
                Format: "4 caracteres: CRED, CRTS, SPAY, SPRI ou SSTD",
                MxPath: "SvcLvl/Cd"),

            ["32A"] = new(
                Name: "Value Date / Currency / Interbank Settled Amount",
                Description: "Data de liquidação interbancária, código ISO 4217 da moeda "
                    + "e valor da transferência entre os bancos.",
                Format: "YYMMDD + código moeda (3) + valor (vírgula como decimal)",
                MxPath: "IntrBkSttlmDt + IntrBkSttlmAmt @Ccy",
                SubFieldLabels: ["Data", "Moeda", "Valor"]),

            ["33B"] = new(
                Name: "Currency / Original Ordered Amount",
                Description: "Moeda e valor originalmente solicitado pelo cliente antes "
                    + "de qualquer conversão cambial.",
                Format: "código moeda (3) + valor",
                MxPath: "InstdAmt @Ccy",
                SubFieldLabels: ["Moeda", "Valor"]),

            ["36"] = new(
                Name: "Exchange Rate",
                Description: "Taxa de câmbio aplicada quando as moedas do campo 32A e "
                    + "33B diferem.",
                Format: "taxa decimal com até 12 dígitos",
                MxPath: "XchgRate"),

            ["50A"] = new(
                Name: "Ordering Customer (BIC)",
                Description: "Cliente ordenante identificado pelo BIC quando é uma "
                    + "instituição financeira.",
                Format: "BIC (8 ou 11 caracteres)",
                MxPath: "Dbtr/FinInstnId/BICFI"),

            ["50F"] = new(
                Name: "Ordering Customer (Structured)",
                Description: "Cliente ordenante em formato estruturado alinhado com "
                    + "ISO 20022: identificador, nome e endereço separados.",
                Format: "/conta\\n1/nome\\n2/endereço\\n3/país/cidade",
                MxPath: "Dbtr/Nm + Dbtr/PstlAdr + DbtrAcct"),

            ["50K"] = new(
                Name: "Ordering Customer (Free Format)",
                Description: "Cliente ordenante em formato livre: até 4 linhas de 35 "
                    + "caracteres para conta, nome e endereço. Formato legado sem "
                    + "estrutura definida — requer interpretação manual.",
                Format: "/conta (opcional)\\nnome\\nendereço (1-3 linhas)",
                MxPath: "Dbtr/Nm + Dbtr/PstlAdr + DbtrAcct",
                Confidence: MtFieldConfidence.Ambiguous,
                MxAlternatives:
                [
                    "DbtrAcct/Id/IBAN", "DbtrAcct/Id/Othr/Id",
                    "Dbtr/Nm", "Dbtr/PstlAdr/AdrLine",
                    "Dbtr/PstlAdr/StrtNm", "Dbtr/PstlAdr/TwnNm",
                    "Dbtr/PstlAdr/Ctry",
                ]),

            ["52A"] = new(
                Name: "Ordering Institution (BIC)",
                Description: "Banco do cliente ordenante — instituição que recebeu a "
                    + "instrução de pagamento do cliente.",
                Format: "BIC (8 ou 11 caracteres)",
                MxPath: "DbtrAgt/FinInstnId/BICFI"),

            ["53A"] = new(
                Name: "Sender's Correspondent",
                Description: "Banco correspondente do remetente — banco através do qual "
                    + "o remetente tem uma relação de conta para liquidação.",
                Format: "BIC (8 ou 11 caracteres)",
                MxPath: "IntrmyAgt1/FinInstnId/BICFI"),

            ["54A"] = new(
                Name: "Receiver's Correspondent",
                Description: "Banco correspondente do destinatário — banco onde o "
                    + "destinatário tem uma conta de Nostro.",
                Format: "BIC (8 ou 11 caracteres)",
                MxPath: "CdtrAgt/FinInstnId/BICFI"),

            ["56A"] = new(
                Name: "Intermediary Institution",
                Description: "Banco intermediário na cadeia de pagamento, entre o banco "
                    + "correspondente e o banco do beneficiário.",
                Format: "BIC (8 ou 11 caracteres)",
                MxPath: "IntrmyAgt2/FinInstnId/BICFI"),

            ["57A"] = new(
                Name: "Account With Institution",
                Description: "Banco onde o beneficiário final mantém sua conta. É o "
                    + "banco que vai creditar os fundos ao beneficiário.",
                Format: "BIC (8 ou 11 caracteres)",
                MxPath: "CdtrAgt/FinInstnId/BICFI"),

            ["59"] = new(
                Name: "Beneficiary Customer",
                Description: "Beneficiário final do pagamento — receptor dos fundos. "
                    + "Contém conta e dados de identificação em formato livre.",
                Format: "/conta (opcional)\\nnome\\nendereço (1-3 linhas)",
                MxPath: "Cdtr/Nm + CdtrAcct",
                Confidence: MtFieldConfidence.Ambiguous,
                MxAlternatives:
                [
                    "CdtrAcct/Id/IBAN", "CdtrAcct/Id/Othr/Id",
                    "Cdtr/Nm", "Cdtr/PstlAdr/AdrLine",
                    "Cdtr/PstlAdr/StrtNm", "Cdtr/PstlAdr/TwnNm",
                    "Cdtr/PstlAdr/Ctry",
                ]),

            ["59F"] = new(
                Name: "Beneficiary Customer (Structured)",
                Description: "Beneficiário em formato estruturado ISO 20022 — "
                    + "identificador, nome e endereço em campos separados.",
                Format: "/conta\\n1/nome\\n2/endereço\\n3/país/cidade",
                MxPath: "Cdtr/Nm + Cdtr/PstlAdr + CdtrAcct"),

            ["70"] = new(
                Name: "Remittance Information",
                Description: "Informação de remessa em texto livre — referências de "
                    + "faturas, contratos ou notas para o beneficiário. Limitado a "
                    + "4 linhas de 35 caracteres no MT.",
                Format: "até 4 linhas de 35 caracteres",
                MxPath: "RmtInf/Ustrd"),

            ["71A"] = new(
                Name: "Details of Charges",
                Description: "Define quem arca com os encargos bancários intermediários. "
                    + "OUR=devedor paga tudo, SHA=cada um paga o seu banco, BEN=credor "
                    + "paga tudo.",
                Format: "3 caracteres: OUR, SHA ou BEN",
                MxPath: "ChrgBr",
                CodeMapping: new Dictionary<string, string>
                {
                    ["OUR"] = "DEBT",
                    ["SHA"] = "SHAR",
                    ["BEN"] = "CRED",
                }),

            ["71F"] = new(
                Name: "Sender's Charges",
                Description: "Encargos cobrados pelo banco remetente — informado quando "
                    + "71A=SHA ou OUR.",
                Format: "código moeda (3) + valor",
                MxPath: "ChrgsInf/Amt"),

            ["72"] = new(
                Name: "Sender to Receiver Information",
                Description: "Instruções e informações do remetente para o destinatário "
                    + "usando codewords como /BNF/ /ACC/ /INS/ /PRIORITY/.",
                Format: "até 6 linhas com codewords opcionais",
                MxPath: "InstrForNxtAgt/InstrInf",
                Confidence: MtFieldConfidence.Ambiguous,
                MxAlternatives:
                [
                    "InstrForNxtAgt/InstrInf",
                    "Purp/Cd",
                    "RgltryRptg/Dtls/Inf",
                ]),

            // ── Time / instruction / classification codes ─────────────
            ["13C"] = new(
                Name: "Time Indication",
                Description: "Indicação de horário para processamento — usado em "
                    + "pagamentos urgentes para especificar o horário de crédito "
                    + "esperado pelo beneficiário. Repetível até 2 vezes.",
                Format: "/CLSTIME/HHMM+UETR ou /RNCTIME/HHMM+UETR",
                MxPath: "SttlmTmIndctn/CdtDtTm"),

            ["23E"] = new(
                Name: "Instruction Code",
                Description: "Instrução especial para o banco processador. Exemplos: "
                    + "CHQB=pagar por cheque ao beneficiário, HOLD=reter fundos para "
                    + "retirada pelo beneficiário, PHOB=contactar o beneficiário por "
                    + "telefone antes de creditar, TELB=contactar o beneficiário por "
                    + "telex, REPA=relacionado a um pagamento anterior.",
                Format: "4 chars codeword + /informação adicional (opcional, max 30 chars)",
                MxPath: "InstrForCdtrAgt/Cd ou InstrForNxtAgt/Cd",
                Confidence: MtFieldConfidence.Ambiguous,
                MxAlternatives:
                [
                    "InstrForCdtrAgt/Cd",
                    "InstrForNxtAgt/Cd",
                    "Purp/Cd",
                ]),

            ["26T"] = new(
                Name: "Transaction Type Code",
                Description: "Código que classifica a natureza da transação para fins "
                    + "regulatórios ou estatísticos. Exemplos: salários, pensões, "
                    + "dividendos, pagamentos comerciais.",
                Format: "3 caracteres alfanuméricos definidos bilateralmente",
                MxPath: "Purp/Cd"),

            // ── Correspondent / intermediary / AWI option variants ────
            ["53B"] = new(
                Name: "Sender's Correspondent (Option B — Account)",
                Description: "Número da conta do banco correspondente do remetente — "
                    + "opção B indica que o remetente possui múltiplas contas com o "
                    + "destinatário e especifica qual conta usar para liquidação.",
                Format: "/número de conta (obrigatório) + nome instituição (opcional)",
                MxPath: "IntrmyAgt1/FinInstnId/Othr/Id"),

            ["53D"] = new(
                Name: "Sender's Correspondent (Option D — Name/Address)",
                Description: "Banco correspondente do remetente identificado por nome "
                    + "e endereço em texto livre — usado quando o BIC não está disponível.",
                Format: "/conta (opcional) + nome + endereço (até 4 linhas)",
                MxPath: "IntrmyAgt1/FinInstnId/Nm + IntrmyAgt1/FinInstnId/PstlAdr",
                Confidence: MtFieldConfidence.Ambiguous,
                MxAlternatives:
                [
                    "IntrmyAgt1/FinInstnId/Nm",
                    "IntrmyAgt1/FinInstnId/PstlAdr/AdrLine",
                ]),

            ["54B"] = new(
                Name: "Receiver's Correspondent (Option B — Account)",
                Description: "Número de conta do banco correspondente do destinatário.",
                Format: "/número de conta + nome instituição (opcional)",
                MxPath: "CdtrAgt/FinInstnId/Othr/Id"),

            ["54D"] = new(
                Name: "Receiver's Correspondent (Option D — Name/Address)",
                Description: "Banco correspondente do destinatário identificado por nome "
                    + "e endereço — usado quando o BIC não está disponível.",
                Format: "/conta (opcional) + nome + endereço (até 4 linhas)",
                MxPath: "CdtrAgt/FinInstnId/Nm",
                Confidence: MtFieldConfidence.Ambiguous),

            ["56C"] = new(
                Name: "Intermediary Institution (Option C — Account)",
                Description: "Banco intermediário identificado por número de conta.",
                Format: "/número de conta",
                MxPath: "IntrmyAgt2/FinInstnId/Othr/Id"),

            ["56D"] = new(
                Name: "Intermediary Institution (Option D — Name/Address)",
                Description: "Banco intermediário identificado por nome e endereço.",
                Format: "/conta (opcional) + nome + endereço (até 4 linhas)",
                MxPath: "IntrmyAgt2/FinInstnId/Nm",
                Confidence: MtFieldConfidence.Ambiguous),

            ["57B"] = new(
                Name: "Account With Institution (Option B — Account)",
                Description: "Banco do beneficiário identificado por número de conta.",
                Format: "/número de conta + nome instituição (opcional)",
                MxPath: "CdtrAgt/FinInstnId/Othr/Id"),

            ["57D"] = new(
                Name: "Account With Institution (Option D — Name/Address)",
                Description: "Banco do beneficiário identificado por nome e endereço — "
                    + "muito usado quando o banco não possui BIC SWIFT.",
                Format: "/conta (opcional) + nome + endereço (até 4 linhas de 35 chars)",
                MxPath: "CdtrAgt/FinInstnId/Nm + CdtrAgt/FinInstnId/PstlAdr",
                Confidence: MtFieldConfidence.Ambiguous,
                MxAlternatives:
                [
                    "CdtrAgt/FinInstnId/Nm",
                    "CdtrAgt/FinInstnId/PstlAdr/AdrLine",
                ]),

            // ── MT202 / MT202COV specifics ────────────────────────────
            ["21"] = new(
                Name: "Related Reference",
                Description: "Referência da mensagem relacionada — para MT202COV, é a "
                    + "referência do MT103 subjacente.",
                Format: "até 16 caracteres alfanuméricos",
                MxPath: "PmtId/EndToEndId"),

            ["25"] = new(
                Name: "Account Identification",
                Description: "Identificação de conta — usado no MT202 para especificar "
                    + "a conta a ser debitada.",
                Format: "número de conta alfanumérico",
                MxPath: "DbtrAcct/Id/Othr/Id"),

            ["52D"] = new(
                Name: "Ordering Institution (Option D — Name/Address)",
                Description: "Banco do cliente ordenante identificado por nome e "
                    + "endereço — alternativa ao 52A quando o BIC não está disponível.",
                Format: "/conta (opcional) + nome + endereço (até 4 linhas)",
                MxPath: "DbtrAgt/FinInstnId/Nm",
                Confidence: MtFieldConfidence.Ambiguous),

            ["58A"] = new(
                Name: "Beneficiary Institution",
                Description: "Instituição financeira beneficiária — banco que receberá "
                    + "os fundos. Exclusivo de MT202/MT202COV.",
                Format: "BIC (8 ou 11 caracteres)",
                MxPath: "Cdtr/FinInstnId/BICFI"),

            ["59A"] = new(
                Name: "Beneficiary Customer (Option A — BIC)",
                Description: "Beneficiário final identificado pelo BIC — usado no "
                    + "MT202COV quando o beneficiário é uma instituição financeira, ou "
                    + "em alguns MT103 onde o beneficiário é identificado pelo BIC.",
                Format: "BIC (8 ou 11 caracteres)",
                MxPath: "Cdtr/FinInstnId/BICFI"),

            // ── Charge counter-parties + regulatory / envelope ────────
            ["71G"] = new(
                Name: "Receiver's Charges",
                Description: "Encargos cobrados pelo banco destinatário — informado "
                    + "quando 71A=SHA indicando o valor dos encargos que serão "
                    + "debitados do beneficiário. Par do campo 71F (encargos do "
                    + "remetente).",
                Format: "código moeda (3) + valor decimal",
                MxPath: "ChrgsInf/Amt"),

            ["77B"] = new(
                Name: "Regulatory Reporting",
                Description: "Informações de reporte regulatório exigidas pelas "
                    + "autoridades monetárias do país do remetente ou destinatário. "
                    + "Contém codewords como /ORDERRES/ (país de residência do "
                    + "ordenante) ou /BENEFRES/ (país de residência do beneficiário).",
                Format: "/CODEWORD/[país ISO]/informação (até 3 linhas de 35 chars)",
                MxPath: "RgltryRptg/Dtls/Cd + RgltryRptg/Dtls/Inf",
                Confidence: MtFieldConfidence.Ambiguous,
                MxAlternatives:
                [
                    "RgltryRptg/Dtls/Cd",
                    "RgltryRptg/Dtls/Inf",
                    "RgltryRptg/Authrty/Nm",
                    "RgltryRptg/Authrty/Ctry",
                ]),

            ["77T"] = new(
                Name: "Envelope Contents",
                Description: "Conteúdo de remessa em formato não-SWIFT — EDIFACT, ANSI "
                    + "X12 ou outros formatos estruturados de informação de remessa.",
                Format: "conteúdo livre do envelope",
                Confidence: MtFieldConfidence.NoMapping),

            // ── Header pseudo-tags ─────────────────────────────────────
            ["Block1"] = new(
                Name: "Basic Header Block",
                Description: "Cabeçalho básico do SWIFT — contém o BIC do remetente e "
                    + "o número de sequência da sessão.",
                Format: "{1:F01BICXXXXXXXX0000000000}",
                Confidence: MtFieldConfidence.NoMapping),

            ["Block2"] = new(
                Name: "Application Header Block",
                Description: "Cabeçalho de aplicação — contém o tipo da mensagem (MT103, "
                    + "MT202) e o BIC do destinatário.",
                Format: "{2:I103BICXXXXXXXXXXXXXXX}",
                Confidence: MtFieldConfidence.NoMapping),

            ["Block3_121"] = new(
                Name: "Unique End-to-End Transaction Reference (UETR)",
                Description: "UUID v4 obrigatório desde novembro 2018 — permite "
                    + "rastreamento fim-a-fim via SWIFT GPI.",
                Format: "UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
                MxPath: "PmtId/UETR"),

            ["Block5"] = new(
                Name: "Trailer Block",
                Description: "Trailer SWIFT — contém checksums (CHK), MAC e marcas de "
                    + "duplicata. Não tem equivalente em ISO 20022.",
                Format: "{5:{CHK:hex}{MAC:hex}}",
                Confidence: MtFieldConfidence.NoMapping),
        };

    public static MtFieldMeta? Lookup(string tag) =>
        Entries.TryGetValue(tag, out var meta) ? meta : null;
}
