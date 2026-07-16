import type { DocSection } from "./types";
import { TPDU_SVG, MESSAGE_STRUCTURE_SVG, EMV_BIT55_ORIGINS_SVG, EMV_DERIVATION_CHAIN_SVG, FOUR_LEGS_FLOW_SVG, ISOHUB_ARCHITECTURE_SVG, PIX_CREDIT_TRANSFER_FLOW_SVG, MT103_DIRECT_FLOW_SVG } from "./diagrams";

/** Long-form documentation in Portuguese. Mirrored by content.en.ts. */
export const DOCS_PT: Record<string, DocSection> = {
  iso8583: {
    id: "iso8583",
    blocks: [
      // ── 1. O que é o ISO 8583 ─────────────────────────────────────────
      { type: "heading", level: 2, text: "O que é o ISO 8583" },
      {
        type: "paragraph",
        text:
          "ISO/IEC 8583 é o padrão internacional que define a estrutura, os campos e a codificação das mensagens eletrônicas trocadas em transações com cartão de pagamento — autorizações, financeiras, reversões, gerenciamento de rede e administrativas.",
      },
      {
        type: "paragraph",
        text:
          "É a linguagem comum entre terminais/POS, adquirentes, bandeiras e emissores: cada participante envia e recebe mensagens nesse formato, em ambas as direções do fluxo (requisição e resposta).",
      },
      {
        type: "paragraph",
        text:
          "O padrão NÃO define o protocolo de transporte (TCP, X.25, SNA, etc.) — apenas o formato da mensagem em si. Cada rede escolhe como enquadrar e transportar essas mensagens; é por isso que aspectos como TPDU, framing por tamanho ou STX/ETX são definidos por cada bandeira/rede, não pelo ISO 8583.",
      },

      // ── 2. Estrutura ──────────────────────────────────────────────────
      { type: "heading", level: 2, text: "Estrutura de uma mensagem" },
      {
        type: "paragraph",
        text:
          "Uma mensagem completa pode ter até 3 partes: TPDU (opcional, de transporte) + MTI + Bitmap(s) + Campos de dados. O TPDU é amplamente usado em redes TCP/IP mas não faz parte do padrão ISO 8583 propriamente dito.",
      },
      { type: "svg", text: MESSAGE_STRUCTURE_SVG },

      // ── 3. TPDU ───────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "TPDU — Transport Protocol Data Unit" },
      {
        type: "callout",
        tone: "info",
        text:
          "O TPDU não é parte do padrão ISO 8583. É um cabeçalho de roteamento adicionado pelo protocolo de transporte de cada rede (Visa, Mastercard, redes adquirentes). Nem todas as implementações usam TPDU.",
      },
      {
        type: "paragraph",
        text:
          "Quando presente, são 5 bytes (10 chars hex) prefixando a mensagem ISO 8583. Usado para roteamento TCP entre participantes da rede — diz ao concentrador quem envia e quem deve receber.",
      },
      {
        type: "table",
        headers: ["Bytes", "Campo", "Tamanho", "Exemplo"],
        rows: [
          ["Byte 1", "ID do protocolo", "1 byte", "60"],
          ["Bytes 2-3", "NII de origem", "2 bytes", "0002"],
          ["Bytes 4-5", "NII de destino", "2 bytes", "0001"],
        ],
      },
      { type: "svg", text: TPDU_SVG },
      {
        type: "paragraph",
        text:
          "NII (Network Interface Identifier) é um identificador atribuído pela bandeira a cada participante da rede. Exemplo completo: 6000020001 → protocolo 0x60, origem 0002, destino 0001.",
      },

      // ── 4. MTI ────────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "MTI — Message Type Indicator" },
      {
        type: "paragraph",
        text:
          "4 dígitos numéricos que identificam o tipo da mensagem. Cada dígito tem um significado posicional específico — leia da esquerda para a direita.",
      },
      {
        type: "table",
        headers: ["Dígito", "Nome", "Valores"],
        rows: [
          ["1", "Versão", "0 = ISO 8583:1987 · 1 = ISO 8583:1993 · 2 = ISO 8583:2003"],
          ["2", "Classe", "1 = Autorização · 2 = Financeira · 4 = Reversão · 8 = Rede"],
          ["3", "Função", "0 = Requisição · 1 = Resposta · 2 = Aviso · 3 = Resposta de aviso"],
          ["4", "Origem", "0 = Adquirente · 2 = Emissor · 4 = Outros"],
        ],
      },
      { type: "heading", level: 3, text: "MTIs mais comuns" },
      {
        type: "table",
        headers: ["MTI", "Nome", "Uso típico"],
        rows: [
          ["0100", "Authorization Request", "Pré-autorização (sem débito)"],
          ["0110", "Authorization Response", "Resposta à pré-autorização"],
          ["0200", "Financial Request", "Débito imediato (compra, saque)"],
          ["0210", "Financial Response", "Resposta à transação financeira"],
          ["0400", "Reversal Request", "Estorno / reversão de transação"],
          ["0410", "Reversal Response", "Confirmação de reversão"],
          ["0420", "Reversal Advice", "Aviso de reversão (sem resposta aguardada)"],
          ["0800", "Network Management Request", "Echo test, sign-on / sign-off"],
          ["0810", "Network Management Response", "Resposta ao network management"],
        ],
      },

      // ── 5. Bitmap ─────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "Bitmap — mapa de campos presentes" },
      {
        type: "paragraph",
        text:
          "O bitmap é uma sequência de bits onde cada bit indica se o campo correspondente está presente na mensagem. Bit 1 = presente; bit 0 = ausente.",
      },
      {
        type: "list",
        items: [
          "Bitmap primário: 8 bytes (64 bits) → indica os campos 1 a 64.",
          "Bitmap secundário: 8 bytes (64 bits) → indica os campos 65 a 128.",
          "O bitmap secundário só aparece quando o bit 1 do bitmap primário está ligado.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "O bit 1 do bitmap NÃO representa um campo de dados — é o flag que indica se o bitmap secundário está presente. Por isso o primeiro campo de dados real começa no bit 2 (PAN).",
      },
      { type: "heading", level: 3, text: "Como ler o bitmap byte a byte" },
      {
        type: "code",
        text:
`Bitmap hex:  F2 3C 24 81 28 C0 82 00
Bitmap bin:  11110010 00111100 00100100 10000001
             00101000 11000000 10000010 00000000
             │└──┬──┘ └──┬───┘ └──┬───┘ └──┬───┘
             │  bits     bits     bits     bits
             │  2-8      9-16    17-24    25-32
             │
             └─ bit 1: bitmap secundário presente? (=1, sim)

Lendo cada bit da esquerda para a direita:
  Bit 1  = 1 → bitmap secundário presente (campos 65-128 podem existir)
  Bit 2  = 1 → campo 2 (PAN) presente
  Bit 3  = 1 → campo 3 (Processing Code) presente
  Bit 4  = 1 → campo 4 (Amount, Transaction) presente
  Bit 5  = 0 → campo 5 ausente
  Bit 6  = 0 → campo 6 ausente
  Bit 7  = 1 → campo 7 (Transmission DateTime) presente
  Bit 8  = 0 → campo 8 ausente
  ... e assim por diante até o bit 64`,
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Para ler manualmente: converta cada par hex para binário (ex.: F2 → 11110010). O bit mais significativo (MSB) de cada byte corresponde ao menor número de campo daquele grupo de 8.",
      },

      // ── 6. Data Elements ──────────────────────────────────────────────
      { type: "heading", level: 2, text: "Campos (Data Elements)" },
      {
        type: "paragraph",
        text:
          "Cada campo tem: número (1-128), nome, tipo de encoding (como o conteúdo é codificado), tipo de comprimento (fixo ou variável) e tamanho máximo.",
      },
      { type: "heading", level: 3, text: "Tipos de encoding" },
      {
        type: "table",
        headers: ["Tipo", "Significado", "Exemplo"],
        rows: [
          ["n", "Numérico (0-9)", `"000001"`],
          ["a", "Alfabético (A-Z, espaço)", `"COMPRA"`],
          ["an", "Alfanumérico", `"LOJA01"`],
          ["ans", "Alfanumérico + especial", `"LOJA/01"`],
          ["b", "Binário", "bytes raw"],
          ["z", "Trilha magnética", `"4111=2512"`],
          ["x+n", "Sinal (C/D) + numérico", `"C000000010000"`],
        ],
      },
      { type: "heading", level: 3, text: "Tipos de comprimento" },
      {
        type: "table",
        headers: ["Tipo", "Significado"],
        rows: [
          ["FIXED", "Tamanho fixo, sempre igual"],
          ["LLVAR", "2 dígitos de comprimento + valor (max 99)"],
          ["LLLVAR", "3 dígitos de comprimento + valor (max 999)"],
        ],
      },
      {
        type: "code",
        text:
`Exemplo LLVAR — campo 35 (Track 2) com valor "4111111111111111=2512":

  20 4111111111111111=2512
  ┬─ ─────────────────────
  │           valor (20 caracteres)
  │
  └ comprimento "20" em 2 dígitos`,
      },

      // ── 7. Campos mais importantes ────────────────────────────────────
      { type: "heading", level: 2, text: "Campos mais importantes" },
      {
        type: "paragraph",
        text:
          "Os campos a seguir aparecem na maioria das transações e são essenciais para entender qualquer mensagem ISO 8583 — o ISOLeaf também os destaca no Builder e no Parser.",
      },

      { type: "heading", level: 3, text: "Bit 2 — PAN (Primary Account Number)" },
      {
        type: "paragraph",
        text:
          "Tipo: LLVAR n, máx 19 dígitos. O número do cartão. Os primeiros 6-8 dígitos formam o BIN, que identifica o emissor e a bandeira. Sempre mascarado na exibição (ex.: 636368******4970).",
      },

      { type: "heading", level: 3, text: "Bit 3 — Processing Code" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 6. Seis dígitos divididos em 3 subcampos de 2 dígitos cada — descrevem o que a transação faz, de qual conta e para qual conta.",
      },
      {
        type: "table",
        headers: ["Posição", "Subcampo", "Valores comuns"],
        rows: [
          ["1-2", "Tipo de transação", "00 = Compra · 01 = Saque · 20 = Devolução · 30 = Consulta"],
          ["3-4", "Conta debitada (from)", "00 = Default · 10 = Poupança · 20 = Corrente · 30 = Crédito"],
          ["5-6", "Conta creditada (to)", "00 = Default · 10 = Poupança · 20 = Corrente · 30 = Crédito"],
        ],
      },
      {
        type: "code",
        text:
`Exemplos:
  003000 → Compra crédito  (00 = compra, 30 = crédito, 00 = default)
  012020 → Saque à vista   (01 = saque,  20 = corrente, 20 = corrente)
  203000 → Devolução / estorno de compra crédito`,
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Os subcampos 3-4 e 5-6 não são universais — cada bandeira/adquirente pode usar combinações próprias. Visa, Mastercard e Elo, por exemplo, divergem em alguns valores para débito à vista vs. parcelado e para crédito vs. débito de poupança. Sempre consulte o catálogo de processing codes do parceiro com quem você integra.",
      },

      { type: "heading", level: 3, text: "Bit 4 — Amount, Transaction" },
      {
        type: "paragraph",
        text: `Tipo: FIXED n 12. Valor da transação em centavos, sem separador decimal. Ex.: 000000018233 = R$ 182,33.`,
      },

      { type: "heading", level: 3, text: "Bit 7 — Transmission Date & Time" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 10. Formato MMDDHHmmss (mês, dia, hora, minuto, segundo) em UTC. Ex.: 0522104642 = 22 de maio, 10:46:42.",
      },

      { type: "heading", level: 3, text: "Bit 11 — STAN (Systems Trace Audit Number)" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 6. Número sequencial da transação gerado pelo terminal. Único por terminal por dia. Usado para rastreamento e para correlacionar requisição e resposta. Ex.: 000042.",
      },

      { type: "heading", level: 3, text: "Bit 22 — POS Entry Mode" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 3. Como o cartão foi lido pelo terminal. Diferente do conceito de \"canal\" — o canal é uma abstração da aplicação; o POS Entry Mode é o que o terminal efetivamente reportou.",
      },
      {
        type: "table",
        headers: ["Valor", "Canal", "Descrição"],
        rows: [
          ["010", "Manual / digitado", "PAN digitado no teclado"],
          ["021", "Tarja magnética", "Leitura da trilha"],
          ["051", "Chip (EMV)", "Contato no chip, dados validados"],
          ["071", "Contactless / NFC", "Aproximação do cartão ou celular"],
          ["090", "Tarja (fallback de chip)", "Chip não-leu, caiu para tarja"],
          ["801", "Tarja, sem CVV", "Fallback sem PIN"],
        ],
      },

      { type: "heading", level: 3, text: "Bit 35 — Track 2 Data" },
      {
        type: "paragraph",
        text:
          "Tipo: LLVAR z, máx 37 chars. Dados da faixa 2 da tarja magnética. Formato: PAN=AAMM[Service Code][Dados discricionários]. Ex.: 4111111111111111=25121011234567890. O separador \"=\" divide o PAN dos dados de serviço (D na trilha real, convertido para = na transmissão).",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "O Track 2 contém dados sensíveis do cartão. Nunca armazene ou transmita sem criptografia / tokenização (PCI DSS).",
      },

      { type: "heading", level: 3, text: "Bit 37 — RRN (Retrieval Reference Number)" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED an 12. Número de referência único atribuído pelo adquirente. Usado para identificar a transação em estornos, chargebacks e conciliação. Deve ser único por dia.",
      },

      { type: "heading", level: 3, text: "Bit 38 — Authorization ID Response" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED an 6. Código de autorização retornado pelo emissor quando a transação é aprovada. Ex.: \"123456\". Presente apenas na resposta (0110 / 0210).",
      },

      { type: "heading", level: 3, text: "Bit 39 — Response Code" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED an 2. Resultado da autorização. \"00\" = aprovado; demais valores indicam o motivo da recusa.",
      },
      {
        type: "table",
        headers: ["RC", "Significado"],
        rows: [
          ["00", "Aprovado"],
          ["05", "Não autorizado (genérico)"],
          ["12", "Transação inválida"],
          ["14", "PAN inválido"],
          ["41", "Cartão perdido"],
          ["43", "Cartão roubado"],
          ["51", "Saldo insuficiente"],
          ["54", "Cartão vencido"],
          ["55", "PIN incorreto"],
          ["57", "Transação não permitida ao portador"],
          ["62", "Cartão com restrição"],
          ["91", "Emissor indisponível"],
        ],
      },

      { type: "heading", level: 3, text: "Bit 41 — Terminal ID" },
      { type: "paragraph", text: "Tipo: FIXED ans 8. Identificador único do terminal cadastrado no adquirente." },

      { type: "heading", level: 3, text: "Bit 42 — Merchant ID" },
      { type: "paragraph", text: "Tipo: FIXED ans 15. Identificador único do estabelecimento comercial." },

      { type: "heading", level: 3, text: "Bit 49 — Currency Code, Transaction" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 3. Código ISO 4217 da moeda da transação. 986 = BRL (Real brasileiro), 840 = USD, 978 = EUR.",
      },

      { type: "heading", level: 3, text: "Bit 52 — PIN Data" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED b 8. PIN Block criptografado (8 bytes = 16 hex chars) no formato ISO 9564. Criptografado com a ZPK (Zone PIN Key) acordada entre adquirente e bandeira.",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "O PIN Block é dado ultrassensível. Nunca exibir em texto claro. O ISOLeaf exibe sempre como ******** (mascarado).",
      },

      { type: "heading", level: 3, text: "Bit 55 — ICC Data (EMV)" },
      {
        type: "paragraph",
        text:
          "Tipo: LLLVAR b, máx 255 bytes. Dados do chip EMV no formato BER-TLV. Contém o ARQC (criptograma do chip), ATC, TVR, AIP e dezenas de outras tags. Veja a seção \"EMV & Criptografia\" para detalhes completos.",
      },

      { type: "heading", level: 3, text: "Bit 90 — Original Data Elements" },
      {
        type: "paragraph",
        text:
          "Tipo: FIXED n 42. Presente apenas em reversões (MTI 04xx). Contém os dados da transação original empacotados: MTI original (4) + STAN (6) + DateTime (10) + RRN (12) + zeros até completar 42.",
      },

      // ── 8. Mensagem completa comentada ────────────────────────────────
      { type: "heading", level: 2, text: "Exemplo de mensagem completa" },
      {
        type: "paragraph",
        text:
          "Para fixar como tudo se encadeia, segue um exemplo comentado de uma 0200 (financial request, compra crédito chip) com TPDU. Cada linha do exemplo é uma fatia da wire ASCII real.",
      },
      {
        type: "code",
        text:
`Wire completa:
6000020001 0200 F23C248128C08200 16 4111111111111111 003000 000000018233 0522104642 000042 ...

Quebrada parte a parte:

  6000020001                       ← TPDU (5 bytes / 10 hex)
    60       protocolo
    0002     NII origem (adquirente)
    0001     NII destino (bandeira)

  0200                             ← MTI (Financial Request)

  F23C248128C08200                 ← Bitmap primário (8 bytes)
    bit 1 = 1 → tem bitmap secundário? (este exemplo não tem,
                bit 1 está 0; F2 = 11110010)
    bits 2,3,4,7,11,12,...        → campos presentes

  16 4111111111111111              ← Bit 2 — PAN (LLVAR)
    "16" = comprimento, depois 16 dígitos do PAN

  003000                           ← Bit 3 — Processing Code
    00 = compra · 30 = crédito · 00 = default

  000000018233                     ← Bit 4 — Amount (12 dígitos)
    R$ 182,33

  0522104642                       ← Bit 7 — Transmission DateTime
    22/maio 10:46:42 UTC

  000042                           ← Bit 11 — STAN
    42ª transação do terminal no dia

  ...                              ← demais campos seguem na ordem
                                     do bitmap (12, 13, 14, 22, 35, 37,
                                     41, 42, 49, 52, 55 ...)`,
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "O exemplo acima é didático — os espaços e comentários são apenas para leitura. Para testar no Parser, use uma mensagem ISO 8583 real gerada pelo Builder (sem espaços, sem comentários). O Parser aceita ASCII wire e binary-hex sem separadores.",
      },

      // ── 9. Formatos de wire ───────────────────────────────────────────
      { type: "heading", level: 2, text: "Formatos de wire" },
      {
        type: "paragraph",
        text:
          "O ISOLeaf suporta automaticamente dois formatos de transmissão da mesma mensagem ISO 8583:",
      },
      {
        type: "table",
        headers: ["Formato", "Descrição", "Exemplo (início)"],
        rows: [
          ["ASCII wire", "Campos representados como texto ASCII", `"0200F23C...NJJZ3Z"`],
          ["Binary-hex", "Bytes em hexadecimal (cada byte = 2 chars)", `"30323030463233..."`],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "ASCII wire e binary-hex são apenas encodings diferentes da mesma mensagem ISO 8583. O Parser do ISOLeaf detecta automaticamente qual formato foi colado — você não precisa indicar.",
      },
      {
        type: "code",
        text:
`Mesmo MTI "0200" em três representações:

  ASCII wire:    0200          (4 chars ASCII; bytes na wire: 30 32 30 30)
  Binary-hex:    30323030      (hex dos bytes ASCII acima — 8 chars)
  Binário puro:  02 00         (2 bytes binários — NÃO é ASCII;
                                 raro em ISO 8583, comum em EMV TLV)`,
      },
    ],
  },

  emv: {
    id: "emv",
    blocks: [
      // ── 1. O que é EMV ───────────────────────────────────────────────
      { type: "heading", level: 2, text: "O que é EMV" },
      {
        type: "paragraph",
        text:
          "Padrão global (Europay, Mastercard, Visa) para transações com chip. Define a comunicação entre chip e terminal e os mecanismos criptográficos que autenticam cada transação.",
      },
      {
        type: "paragraph",
        text:
          "Diferente do ISO 8583 (que define a mensagem de rede), o EMV define o que acontece ANTES da mensagem ser enviada: a geração dos dados de segurança pelo chip do cartão.",
      },

      // ── 2. O Bit 55 — de onde vêm os dados ──────────────────────────
      { type: "heading", level: 2, text: "O Bit 55 — de onde vêm os dados" },
      {
        type: "paragraph",
        text:
          "O Bit 55 é uma composição de dados de três origens distintas. É importante entender isso para saber o que pode ser manipulado em testes.",
      },
      { type: "svg", text: EMV_BIT55_ORIGINS_SVG },

      { type: "heading", level: 3, text: "Dados do chip (personalização)" },
      {
        type: "paragraph",
        text:
          "Tags que o emissor gravou no chip quando emitiu o cartão. Definem as capacidades e configurações do cartão. O ISOLeaf gera valores realistas para estas quando você usa o Builder com canal Chip.",
      },
      { type: "heading", level: 3, text: "Dados do terminal" },
      {
        type: "paragraph",
        text:
          "Tags que o terminal adiciona ao Bit 55. Descrevem as capacidades físicas do equipamento. Os valores dependem de como o terminal foi configurado.",
      },
      { type: "heading", level: 3, text: "Dados negociados" },
      {
        type: "paragraph",
        text:
          "Tags cujos valores resultam da interação chip-terminal durante a transação (antes do ARQC ser calculado). O TVR (Terminal Verification Results), por exemplo, registra o resultado de cada verificação realizada.",
      },
      { type: "heading", level: 3, text: "Dados gerados pelo chip por transação" },
      {
        type: "paragraph",
        text:
          "O ARQC (tag 9F26) é calculado pelo chip a cada transação. O ATC (tag 9F36) incrementa a cada transação — nunca se repete. São os dados que provam que o chip físico estava presente.",
      },

      // ── 3. Estrutura BER-TLV ────────────────────────────────────────
      { type: "heading", level: 2, text: "Estrutura BER-TLV" },
      {
        type: "paragraph",
        text:
          "O Bit 55 usa BER-TLV (Basic Encoding Rules — Tag Length Value), um padrão de codificação derivado do ASN.1.",
      },
      { type: "paragraph", text: "Cada elemento TLV tem 3 partes:" },
      {
        type: "table",
        headers: ["Parte", "Tamanho", "Descrição"],
        rows: [
          ["TAG", "1-2 bytes", "Identifica o campo. Se bits 4-0 = 11111, o próximo byte é parte da tag."],
          ["LENGTH", "1-3 bytes", "Short form: 1 byte (<128). Long form: 0x81+N ou 0x82+NN."],
          ["VALUE", "N bytes", "Conteúdo do campo."],
        ],
      },
      {
        type: "code",
        text:
`Bit 55 (hex): 9F 26 08 A1 B2 C3 D4 E5 F6 07 08 9F 36 02 00 1E

Decompondo:
  9F 26              ← TAG 9F26 (2 bytes, pois 9F = ...11111)
  08                 ← LENGTH = 8 bytes
  A1B2C3D4E5F60708   ← VALUE = ARQC (8 bytes)

  9F 36              ← TAG 9F36 (2 bytes)
  02                 ← LENGTH = 2 bytes
  00 1E              ← VALUE = ATC = 30 decimal (30ª transação)`,
      },
      {
        type: "callout",
        tone: "info",
        text:
          "O ISOLeaf monta e parseia BER-TLV automaticamente. Use Dados EMV → Parse Bit 55 para decompor qualquer Bit 55 em suas tags. O parse é parcial — se encontrar uma tag desconhecida, continua parseando as próximas.",
      },

      // ── 4. Tabela de tags ───────────────────────────────────────────
      { type: "heading", level: 2, text: "Tags mais importantes" },
      {
        type: "table",
        headers: ["Tag", "Nome", "Origem", "Tamanho", "Descrição"],
        rows: [
          ["9F26", "ARQC", "Chip/transação", "8 bytes", "Criptograma de autorização"],
          ["9F27", "CID", "Chip/transação", "1 byte", "Tipo de criptograma (80=ARQC)"],
          ["9F10", "IAD", "Chip/transação", "variável", "Dados internos do emissor"],
          ["9F36", "ATC", "Chip/transação", "2 bytes", "Contador de transações"],
          ["9F37", "UN", "Terminal", "4 bytes", "Número imprevisível"],
          ["9F02", "Amount", "Terminal", "6 bytes", "Valor autorizado"],
          ["9F03", "Amount Other", "Terminal", "6 bytes", "Valor adicional"],
          ["9A", "Tx Date", "Terminal", "3 bytes", "Data da transação (YYMMDD)"],
          ["9C", "Tx Type", "Terminal", "1 byte", "Tipo (00=compra, 01=saque)"],
          ["95", "TVR", "Negociado", "5 bytes", "Terminal Verification Results"],
          ["82", "AIP", "Chip", "2 bytes", "Application Interchange Profile"],
          ["9F33", "Term Cap", "Terminal", "3 bytes", "Capacidades do terminal"],
          ["8E", "CVM List", "Chip", "variável", "Lista de métodos de verificação"],
          ["9F34", "CVM Results", "Negociado", "3 bytes", "Resultado da verificação do portador"],
          ["9F35", "Term Type", "Terminal", "1 byte", "Tipo de terminal"],
          ["9F1A", "Term Country", "Terminal", "2 bytes", "País do terminal"],
        ],
      },

      // ── 5. Cadeia de derivação ──────────────────────────────────────
      { type: "heading", level: 2, text: "Cadeia de derivação EMV" },
      {
        type: "paragraph",
        text:
          "O ARQC não é mágico — é o último elo de uma cadeia de derivação de chaves que começa no HSM do emissor e termina como 8 bytes na mensagem ISO 8583.",
      },
      { type: "svg", text: EMV_DERIVATION_CHAIN_SVG },
      {
        type: "paragraph",
        text:
          "Cada nível usa o anterior + um dado específico da transação. Isso garante que a chave que calcula o ARQC seja única para AQUELA transação naquele cartão — qualquer replay é detectável pelo emissor.",
      },

      // ── 6. A IMK no ISOLeaf ──────────────────────────────────────────
      { type: "heading", level: 2, text: "A IMK no ISOLeaf" },
      { type: "heading", level: 3, text: "Por que o ISOLeaf usa a IMK?" },
      {
        type: "paragraph",
        text:
          "Em produção, a IMK fica protegida em um HSM (Hardware Security Module) do emissor — nunca é exposta em texto claro.",
      },
      { type: "paragraph", text: "O ISOLeaf usa a IMK para fins de desenvolvimento e testes:" },
      {
        type: "list",
        items: [
          "Builder: quando a IMK está configurada no Workspace, o Builder gera ARQC criptograficamente real em vez de um valor aleatório. O badge \"✓ ARQC derivado\" confirma isso.",
          "Validar ARQC: valida se um ARQC recebido é legítimo para uma determinada IMK e PAN. Útil para testar a integração do emissor.",
          "Full Flow: executa toda a cadeia IMK → ICC MK → Session Key → validação do ARQC → geração do ARPC em um único passo.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Use apenas IMKs de teste — nunca configure uma IMK de produção no ISOLeaf ou em qualquer ferramenta de desenvolvimento. Em produção, a IMK só deve existir dentro de um HSM certificado.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Para configurar a IMK: Workspace → Chaves criptográficas → Issuer Master Key (32 hex chars).",
      },

      // ── 7. ARPC ─────────────────────────────────────────────────────
      { type: "heading", level: 2, text: "ARPC — Resposta do emissor" },
      {
        type: "paragraph",
        text:
          "Após validar o ARQC, o emissor calcula o ARPC para provar ao terminal que quem respondeu é realmente o emissor legítimo. O ARPC vai no Bit 55 da resposta (tag 91).",
      },
      {
        type: "table",
        headers: ["Método", "Fórmula", "Quando usar"],
        rows: [
          ["Method 1", "3DES(Session Key, ARQC XOR RC)", "Visa CVN 10/18, Elo"],
          ["Method 2", "MAC(Session Key, CSU || dados)", "Mastercard M/Chip"],
        ],
      },
      {
        type: "paragraph",
        text:
          "Onde RC = Response Code (2 bytes do bit 39: \"00\" = aprovado) e CSU = Card Status Update (4 bytes — permite atualizar o status do chip).",
      },

      // ── 8. Decodificadores em breve ─────────────────────────────────
      { type: "heading", level: 2, text: "Decodificadores de tags — em breve" },
      {
        type: "paragraph",
        text:
          "Algumas tags do Bit 55 são bitmaps onde cada bit tem um significado específico. O ISOLeaf planeja implementar decodificadores visuais para essas tags.",
      },
      { type: "heading", level: 3, text: "TVR (Tag 95) — Terminal Verification Results" },
      { type: "paragraph", text: "5 bytes = 40 bits, cada um indicando uma verificação:" },
      {
        type: "table",
        headers: ["Bit", "Posição", "Significado"],
        rows: [
          ["Bit 1",  "1.8", "Offline data auth não realizada"],
          ["Bit 2",  "1.7", "SDA falhou"],
          ["Bit 3",  "1.6", "ICC data missing"],
          ["Bit 4",  "1.5", "Cartão no exception file do terminal"],
          ["Bit 5",  "1.4", "DDA falhou"],
          ["Bit 6",  "1.3", "CDA falhou"],
          ["Bit 7",  "2.8", "ICC e terminal têm versões de app diferentes"],
          ["Bit 8",  "2.4", "PIN inválido digitado"],
          ["Bit 9",  "2.3", "PIN entry bypassed"],
          ["Bit 10", "3.8", "Limite offline de transações excedido"],
          ["Bit 11", "4.8", "Transação selecionada aleatoriamente p/ review"],
          ["Bit 12", "5.8", "Merchant forced transaction online"],
        ],
      },
      { type: "heading", level: 3, text: "AIP (Tag 82) — Application Interchange Profile" },
      { type: "paragraph", text: "2 bytes indicando o que o cartão suporta:" },
      {
        type: "table",
        headers: ["Bit", "Significado"],
        rows: [
          ["1.7", "SDA suportado"],
          ["1.6", "DDA suportado"],
          ["1.5", "Cardholder verification suportado"],
          ["1.4", "Terminal risk management exigido"],
          ["1.3", "Issuer authentication suportado"],
          ["1.1", "CDA suportado"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Os decodificadores de TVR, AIP, TTQ, CVM List e outras tags de bitmap estão no roadmap do ISOLeaf. Quando disponíveis, aparecerão automaticamente no módulo Dados EMV → Parse Bit 55.",
      },
    ],
  },

  roles: {
    id: "roles",
    blocks: [
      // ── 1. Participantes ─────────────────────────────────────────
      { type: "heading", level: 2, text: "Os participantes de uma transação" },
      { type: "heading", level: 3, text: "PORTADOR (Cardholder)" },
      { type: "paragraph", text: "O titular do cartão que realiza a compra." },
      { type: "heading", level: 3, text: "ESTABELECIMENTO (Merchant)" },
      { type: "paragraph", text: "O lojista que aceita o pagamento." },
      { type: "heading", level: 3, text: "TERMINAL / POS" },
      { type: "paragraph", text: "O equipamento que captura os dados do cartão e envia a mensagem ISO 8583 para o adquirente." },
      { type: "heading", level: 3, text: "ADQUIRENTE (Acquirer)" },
      {
        type: "paragraph",
        text:
          "A credenciadora que conecta o estabelecimento à rede. Recebe a mensagem do terminal e roteia para a bandeira. Exemplos: Cielo, Rede, Stone, GetNet.",
      },
      { type: "heading", level: 3, text: "BANDEIRA (Network/Brand)" },
      {
        type: "paragraph",
        text:
          "O operador da rede de pagamentos. Roteia a mensagem do adquirente para o emissor e define as regras de autorização. Exemplos: Visa, Mastercard, Elo, Amex.",
      },
      { type: "heading", level: 3, text: "EMISSOR (Issuer)" },
      {
        type: "paragraph",
        text:
          "O banco ou instituição que emitiu o cartão. Autoriza ou recusa a transação — verifica o ARQC, saldo, limite, etc. Exemplos: Itaú, Bradesco, Nubank.",
      },
      { type: "heading", level: 3, text: "PROCESSADORA (Processor)" },
      {
        type: "paragraph",
        text:
          "Em alguns modelos, a processadora fica entre a bandeira e o emissor — executa a autorização em nome do emissor. Comum em emissores menores que terceirizam o processamento.",
      },

      // ── 2. Fluxo de quatro pernas ────────────────────────────────
      { type: "heading", level: 2, text: "O fluxo de quatro pernas" },
      {
        type: "paragraph",
        text:
          "Uma transação completa atravessa até quatro participantes em sequência. Cada conexão entre dois deles é chamada de \"perna\" — e cada perna pode usar um protocolo de transporte diferente.",
      },
      { type: "svg", text: FOUR_LEGS_FLOW_SVG },
      {
        type: "paragraph",
        text:
          "Cada perna pode usar protocolos diferentes. O TPDU (Transport Protocol Data Unit) é tipicamente exigido nas pernas 2 e 3 (entre instituições financeiras), enquanto a perna 1 (terminal → adquirente) frequentemente usa protocolos proprietários sem TPDU.",
      },
      {
        type: "paragraph",
        text:
          "No fluxo de resposta, o ARPC calculado pelo emissor volta pelo mesmo caminho (Bandeira → Adquirente → Terminal). O terminal entrega o ARPC ao chip, que valida e aprova ou rejeita localmente.",
      },

      // ── 2b. Classes de mensagem ISO 8583 ────────────────────────
      { type: "heading", level: 2, text: "Classes de mensagem ISO 8583" },
      {
        type: "paragraph",
        text:
          "O segundo dígito do MTI define a CLASSE da mensagem. Entender essa distinção é fundamental para montar mensagens corretas e integrar com qualquer rede.",
      },
      {
        type: "table",
        headers: ["Classe", "MTIs", "Tipo", "Descrição"],
        rows: [
          ["1xx", "0100 / 0110 / 0120 / 0130", "Autorização", "Compras em estabelecimentos, consultas, pré-autorizações"],
          ["2xx", "0200 / 0210 / 0220 / 0230", "Financeiro", "Transações com movimentação financeira imediata (ATM, saques, depósitos)"],
          ["4xx", "0400 / 0410 / 0420 / 0430", "Reversão", "Cancelamento de uma transação anterior (1xx ou 2xx)"],
          ["8xx", "0800 / 0810 / 0820 / 0830", "Rede", "Echo test, sign-on / off, troca de chave, cutover"],
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Distinção crítica entre 0100 e 0200. 0100 — Autorização: o cliente passa o cartão em uma loja, farmácia, restaurante, posto de combustível… O emissor autoriza a operação; o débito efetivo ocorre depois, no processo de liquidação (clearing). 0200 — Financeiro: eventos de ATM (saque, depósito, troca de senha) — transações que movimentam a conta na hora, sem liquidação separada. Este é um dos erros mais comuns em integrações: usar 0200 para compra em loja ou 0100 para saque em ATM.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Redes proprietárias frequentemente definem MTIs customizados para funcionalidades que vão além do padrão ISO 8583, como extratos, pagamentos de contas e serviços específicos. Esses MTIs variam por rede e são definidos na especificação técnica de cada operador — consulte a documentação da rede com que está integrando. O ISOLeaf suporta MTIs customizados via configuração \"MTI desconhecido\" no Simulador.",
      },

      // ── 3. Modos de entrada ──────────────────────────────────────
      { type: "heading", level: 2, text: "Modo de entrada — como o cartão foi lido" },
      {
        type: "paragraph",
        text:
          "O Bit 22 (POS Entry Mode) informa como o cartão foi capturado. Isso muda completamente o que é esperado na mensagem.",
      },
      {
        type: "table",
        headers: ["Código", "Modo", "Bit 35", "Bit 52", "Bit 55", "Uso típico"],
        rows: [
          ["051", "Chip (ICC)", "Presente", "Opcional", "Presente", "Compra em loja com chip"],
          ["090", "Tarja magnética", "Presente", "Opcional", "Ausente", "Fallback para tarja"],
          ["071", "Contactless chip", "Presente", "Ausente", "Presente", "NFC / tap to pay"],
          ["075", "Contactless tarja", "Presente", "Ausente", "Ausente", "NFC sem chip"],
          ["010", "PAN manual (digitado)", "Ausente", "Ausente", "Ausente", "MOTO, call center"],
          ["081", "e-Commerce", "Ausente", "Ausente", "Ausente", "Compra online"],
          ["901", "Fallback (chip→tarja)", "Presente", "Ausente", "Ausente", "Chip defeituoso"],
        ],
      },

      { type: "heading", level: 3, text: "Diferenças técnicas por modo de entrada" },

      { type: "heading", level: 4, text: "Chip (051)" },
      {
        type: "paragraph",
        text:
          "O chip gera o ARQC usando a ICC Master Key derivada da IMK. O Bit 55 é obrigatório e contém o criptograma de autenticação. O emissor valida o ARQC para confirmar que o chip físico participou da transação — a principal proteção anti-fraude. O Bit 35 (Track 2) também é capturado do chip.",
      },

      { type: "heading", level: 4, text: "Tarja magnética (090)" },
      {
        type: "paragraph",
        text:
          "Sem criptograma — apenas os dados da tarja são enviados. O Bit 35 contém PAN + data de validade + service code + dados discricionários. Mais vulnerável a fraude — dados podem ser clonados. Em muitas redes, transações de tarja de cartões com chip são tratadas com mais suspeita (downgrade attack).",
      },

      { type: "heading", level: 4, text: "Contactless (071)" },
      {
        type: "paragraph",
        text:
          "O chip NFC gera um ARQC diferente do contato — usando o TTQ (Terminal Transaction Qualifiers, tag 9F66) e CTQ (Card Transaction Qualifiers, tag 9F6C) para negociar o que acontece offline vs online. Transações de baixo valor podem ser aprovadas offline pelo chip sem sequer chegar ao emissor.",
      },

      { type: "heading", level: 4, text: "CNP — Card Not Present (010, 081)" },
      {
        type: "paragraph",
        text:
          "Sem dados físicos do cartão — apenas PAN, validade e CVV2. Maior risco de fraude — requer controles adicionais: CVV2 (impresso no cartão), 3D Secure, análise de risco. O Bit 61 ou campos privados carregam dados adicionais de e-commerce (URL, device fingerprint, etc.).",
      },

      // ── 4. Quem define os campos obrigatórios ─────────────────────
      { type: "heading", level: 2, text: "Quem define os campos obrigatórios?" },
      {
        type: "paragraph",
        text:
          "A ISO 8583 define apenas a estrutura e o significado dos campos — não define quais são obrigatórios. Cada bandeira e rede define suas próprias regras de obrigatoriedade.",
      },
      {
        type: "table",
        headers: ["Nível", "Quem define", "Exemplo"],
        rows: [
          ["ISO 8583", "O padrão", "Apenas estrutura e codificação"],
          ["Bandeira", "Visa, Mastercard, Elo…", "Bit 19 obrigatório (Visa), Bit 43 (MC)"],
          ["Adquirente", "Cielo, Rede, Stone…", "Campos privados (Bit 47 / 48)"],
          ["Emissor", "Banco emissor", "Pode exigir dados adicionais na resposta"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "No ISOLeaf Builder, o papel selecionado (Adquirente, Bandeira, Emissor) determina quais campos são automaticamente incluídos na mensagem gerada, seguindo as convenções mais comuns do mercado brasileiro.",
      },

      // ── 5. Processing Code ───────────────────────────────────────
      { type: "heading", level: 2, text: "Processing Code — o DNA da transação" },
      {
        type: "paragraph",
        text:
          "O Bit 3 (Processing Code) define o que a transação faz com as contas do portador. São 6 dígitos em 3 subcampos. Veja exemplos comuns no mercado brasileiro:",
      },
      {
        type: "table",
        headers: ["Processing Code", "Transação", "Descrição"],
        rows: [
          ["003000", "Compra Crédito", "Débita conta crédito do portador"],
          ["003010", "Compra Crédito Parcelado", "Parcelamento lojista"],
          ["003030", "Compra Crédito Parcelado Emissor", "Parcelamento banco"],
          ["012020", "Saque à vista", "Débita conta corrente"],
          ["012030", "Saque crédito", "Saque na função crédito (raro)"],
          ["172020", "Consulta de saldo", "Não movimenta conta"],
          ["202020", "Devolução débito", "Crédito na conta corrente"],
          ["203000", "Devolução crédito", "Estorno de crédito"],
          ["302020", "Consulta de extrato", "Apenas informativa"],
          ["602020", "Pagamento de conta", "Crédito para beneficiário"],
        ],
      },

      // ── 6. Companhias aéreas ─────────────────────────────────────
      { type: "heading", level: 2, text: "Transações de companhias aéreas" },
      {
        type: "paragraph",
        text:
          "Transações de companhias aéreas têm características únicas que as diferenciam de uma compra comum em loja. O valor exato da passagem frequentemente não é conhecido no momento da reserva (tarifas, taxas, upgrades), então o fluxo usa pré-autorização + captura (completion).",
      },

      { type: "heading", level: 3, text: "Fluxo típico — airline transaction" },
      {
        type: "list",
        ordered: true,
        items: [
          "PRÉ-AUTORIZAÇÃO (0100 / 0200) — MCC 4511 (Air Carriers, Airlines), Processing Code 003000, valor estimado ou mínimo da tarifa. O emissor bloqueia o valor na conta do portador, mas não debita ainda.",
          "COMPLETION / CAPTURA (0220 — Advice) — após confirmação do bilhete. Valor final com todas as taxas incluídas. Pode ser maior ou menor que a pré-autorização. O Bit 90 pode conter os dados da pré-autorização original.",
          "CANCELAMENTO (0420 — Reversal Advice) — se o passageiro cancelar antes da emissão, libera o valor bloqueado na conta.",
        ],
      },

      { type: "heading", level: 3, text: "Dados específicos de airline" },
      {
        type: "paragraph",
        text:
          "As bandeiras definem campos específicos para dados de voo. Eles geralmente ficam nos campos privados (Bit 47, 48 ou 127) ou em campos específicos como o Bit 111 em algumas redes.",
      },
      {
        type: "table",
        headers: ["Campo", "Dados de voo comuns"],
        rows: [
          ["Bit 43", "Nome do estabelecimento com cidade / aeroporto"],
          ["Bit 47 / 48", "Dados privados: PNR, número do voo, origem / destino"],
          ["Bit 111", "Airline Additional Data (algumas redes)"],
        ],
      },

      { type: "heading", level: 3, text: "Terminologia de airline" },
      {
        type: "list",
        items: [
          "PNR (Passenger Name Record): identificador único da reserva no sistema da companhia aérea. Ex.: \"ABC123\".",
          "Leg Data: dados de cada trecho do voo (origem, destino, data, classe, número do voo).",
          "IATA Code: código de 2-3 letras da cia aérea (LA = LATAM, G3 = Gol).",
          "Ticket Number: número do bilhete eletrônico (e-ticket).",
          "EMD (Electronic Miscellaneous Document): documento para serviços ancilares (bagagem extra, upgrades, etc.).",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "As implementações de airline data variam muito entre bandeiras e adquirentes. Visa, Mastercard e Elo têm especificações próprias para esses campos. Consulte a especificação técnica da bandeira específica para implementação em produção.",
      },

      // ── 7. Outras transações especiais ───────────────────────────
      { type: "heading", level: 2, text: "Outros tipos de transação especiais" },

      { type: "heading", level: 3, text: "Pagamento de contas / débito direto" },
      {
        type: "paragraph",
        text:
          "Processing Code 60xxxx. Usado para pagamento de boletos, contas de água, luz, etc. Crédito direto na conta do beneficiário.",
      },

      { type: "heading", level: 3, text: "Recarga (pré-pago)" },
      {
        type: "paragraph",
        text:
          "Cartões pré-pagos têm fluxo diferente. O emissor é geralmente um processador de cartões pré-pagos. A recarga pode ser feita via Bit 4 com Processing Code específico.",
      },

      { type: "heading", level: 3, text: "Cashback" },
      {
        type: "paragraph",
        text:
          "Processing Code 09xxxx (saque embutido na compra). O Bit 4 = valor da compra + valor do saque. O Bit 54 = breakdown dos valores (compra separado do saque). Permitido em alguns terminais e redes específicas.",
      },

      // ── 8. Como testar no ISOLeaf ─────────────────────────────────
      { type: "heading", level: 2, text: "Como usar o ISOLeaf para testar esses cenários" },
      {
        type: "table",
        headers: ["Cenário", "MTI", "Classe", "Canal", "Descrição"],
        rows: [
          ["Compra crédito em loja (chip)",   "0100", "Autorização",  "Chip",      "Cliente compra em estabelecimento com chip"],
          ["Compra crédito em loja (tarja)",  "0100", "Autorização",  "Tarja",     "Cliente compra em estabelecimento com tarja"],
          ["Compra débito em loja (chip)",    "0100", "Autorização",  "Chip",      "Compra débito com PIN no estabelecimento"],
          ["Compra online / CNP",             "0100", "Autorização",  "CNP",       "E-commerce, MOTO, sem presença física"],
          ["Pré-autorização (posto / hotel)", "0100", "Autorização",  "Chip",      "Reserva valor, ajuste no checkout"],
          ["Saque em ATM",                    "0200", "Financeiro",   "Chip",      "Retirada de dinheiro no caixa eletrônico"],
          ["Troca de senha no ATM",           "0200", "Financeiro",   "Chip",      "Alteração de PIN no caixa eletrônico"],
          ["Depósito em ATM",                 "0200", "Financeiro",   "Chip",      "Crédito imediato na conta via ATM"],
          ["Transações proprietárias",        "Varia por rede", "Proprietário", "Chip", "MTIs customizados definidos pela rede (consulte a especificação técnica da rede)"],
          ["Reversão de compra",              "0400", "Reversão",     "(mesmo)",   "Cancela autorização 0100 anterior"],
          ["Reversão de saque",               "0400", "Reversão",     "(mesmo)",   "Cancela financeiro 0200 anterior"],
          ["Echo test",                       "0800", "Rede",         "(n/a)",     "Verifica conectividade com o emissor / bandeira"],
        ],
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "A linha \"Transações proprietárias\" usa MTI customizado — não é um padrão ISO 8583. Cada rede define seus próprios MTIs para funcionalidades que vão além do escopo do padrão. Para simular esses MTIs no ISOLeaf, configure a sessão do Simulador com \"MTI desconhecido: Custom\" e defina o MTI de resposta correspondente.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "No ISOLeaf Builder: Compra em loja → MTI 0100, Papel Adquirente. Saque em ATM → MTI 0200, Papel Adquirente, Tipo Saque. Reversão → use \"Criar reversão\" no MessagePreview (gera 0400 com Bit 90 preenchido automaticamente). Echo test → MTI 0800.",
      },
    ],
  },

  fields: {
    id: "fields",
    blocks: [
      { type: "paragraph", text: "Tabela dos campos mais importantes do ISO 8583 (Data Elements 2-128)." },
      {
        type: "table",
        headers: ["Bit", "Nome", "Tipo", "Enc.", "Tamanho", "Descrição"],
        rows: [
          ["2", "PAN", "LLVAR", "n", "max 19", "Número do cartão"],
          ["3", "Processing Code", "FIXED", "n", "6", "Tipo de transação"],
          ["4", "Amount, Transaction", "FIXED", "n", "12", "Valor em centavos"],
          ["5", "Amount, Settlement", "FIXED", "n", "12", "Valor de liquidação"],
          ["6", "Amount, Cardholder Billing", "FIXED", "n", "12", "Valor ao portador"],
          ["7", "Transmission Date & Time", "FIXED", "n", "10", "MMDDHHmmss"],
          ["11", "STAN", "FIXED", "n", "6", "Número de rastreamento"],
          ["12", "Local Transaction Time", "FIXED", "n", "6", "HHmmss"],
          ["13", "Local Transaction Date", "FIXED", "n", "4", "MMDD"],
          ["14", "Expiration Date", "FIXED", "n", "4", "AAMM"],
          ["18", "Merchant Type (MCC)", "FIXED", "n", "4", "Categoria do estabelecimento"],
          ["19", "Acquiring Country Code", "FIXED", "n", "3", "País do adquirente"],
          ["22", "POS Entry Mode", "FIXED", "n", "3", "Como o cartão foi lido"],
          ["25", "POS Condition Code", "FIXED", "n", "2", "Condição do POS"],
          ["32", "Acquiring Institution ID", "LLVAR", "n", "max 11", "ID do adquirente"],
          ["35", "Track 2 Data", "LLVAR", "z", "max 37", "Trilha magnética"],
          ["37", "RRN", "FIXED", "an", "12", "Número de referência"],
          ["38", "Authorization ID Response", "FIXED", "an", "6", "Código de autorização"],
          ["39", "Response Code", "FIXED", "an", "2", "'00' = aprovado"],
          ["41", "Terminal ID", "FIXED", "ans", "8", "ID do terminal"],
          ["42", "Merchant ID", "FIXED", "ans", "15", "ID do estabelecimento"],
          ["43", "Card Acceptor Name/Location", "FIXED", "ans", "40", "Nome+cidade do estabelecimento"],
          ["48", "Additional Data — Private", "LLLVAR", "an", "max 999", "Dados privados"],
          ["49", "Currency Code, Transaction", "FIXED", "n", "3", "986 = BRL"],
          ["52", "PIN Data", "FIXED", "b", "8", "PIN Block (binário)"],
          ["54", "Additional Amounts", "LLLVAR", "an", "max 120", "Valores adicionais"],
          ["55", "ICC Data (EMV)", "LLLVAR", "b", "max 255", "Dados do chip BER-TLV"],
          ["57-63", "Reserved National/Private", "LLLVAR", "ans", "max 999", "Reservados nacionais/privados"],
          ["64", "MAC", "FIXED", "b", "8", "Autenticação da mensagem"],
          ["70", "Network Management Info Code", "FIXED", "n", "3", "0800/0810"],
          ["90", "Original Data Elements", "FIXED", "n", "42", "Dados da msg original (reversão)"],
          ["100", "Receiving Institution ID", "LLVAR", "n", "max 11", "ID do emissor"],
          ["127", "Private Use", "LLLVAR", "ans", "max 999", "Uso privado"],
          ["128", "MAC (Extended)", "FIXED", "b", "8", "MAC estendido"],
        ],
      },
      { type: "heading", level: 3, text: "Tipos de encoding" },
      {
        type: "list",
        items: [
          "n = numérico (dígitos 0-9)",
          "a = alfabético (A-Z, espaço)",
          "s = especial (caracteres especiais)",
          "an = alfanumérico",
          "ans = alfanumérico e especial",
          "b = binário",
          "z = trilha magnética (dígitos + separadores)",
          "x+n = sinal (C/D) + numérico",
        ],
      },
      { type: "heading", level: 3, text: "Tipos de comprimento" },
      {
        type: "list",
        items: [
          "FIXED = tamanho fixo",
          "LLVAR = 2 dígitos de comprimento + valor (max 99)",
          "LLLVAR = 3 dígitos de comprimento + valor (max 999)",
        ],
      },
    ],
  },

  iso20022: {
    id: "iso20022",
    blocks: [
      // ── 1. O que é o ISO 20022 ───────────────────────────────────
      { type: "heading", level: 2, text: "O que é o ISO 20022" },
      {
        type: "paragraph",
        text:
          "ISO 20022 é o padrão internacional para mensagens financeiras estruturadas em XML. Diferente do ISO 8583 (orientado a campos posicionais em uma mensagem plana) e do ISO 15022 / SWIFT MT (blocos de texto delimitados por dois-pontos), o ISO 20022 descreve cada mensagem via um XSD versionado — um contrato máquina-a-máquina que carrega semântica (moedas, identidades, hierarquia) em vez de posições.",
      },
      {
        type: "paragraph",
        text:
          "É o sucessor prático do ISO 15022/MT no mundo bancário e o padrão adotado pelo SPI/BCB no Pix e pela rede SWIFT no programa CBPR+ (Cross-Border Payments and Reporting Plus). Um mesmo esqueleto XSD é reaproveitado por diferentes ecossistemas — o que muda são obrigatoriedades, cardinalidades e regras de negócio locais.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "No dia a dia da integração, você não escreve o XML \"na mão\": você compõe uma mensagem contra um XSD, valida contra o schema e envia o resultado. O ISOLeaf cobre o ciclo completo — Parser, Referência, Validador, Comparador de versões, Builder e Flow Visualizer trabalham sobre a mesma biblioteca de XSDs oficiais.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Referência de campos ISO 20022 é dinâmica — ao contrário do ISO 8583, cujos 128 Data Elements são fixos e por isso ganham a página estática **Referência de Campos (ISO 8583)** desta documentação, o conjunto de campos ISO 20022 depende de qual XSD (e qual versão) você está consumindo, incluindo XSDs personalizados que você tenha subido no Workspace. Por isso a exploração dessa árvore vive **dentro do próprio ISOLeaf**, no módulo **Referência de Campos** (menu ISO 20022 → Genérico → Referência de campos): lá você navega o XSD real que o Agent carregou, com busca cruzada por nome de campo entre todas as famílias e versões.",
      },

      // ── 2. Estrutura de uma mensagem ─────────────────────────────
      { type: "heading", level: 2, text: "Estrutura de uma mensagem ISO 20022" },
      {
        type: "paragraph",
        text:
          "Uma mensagem completa é sempre composta por um envelope + um corpo. O envelope pode incluir um Business Application Header (AppHdr) que carrega metadados de roteamento (quem envia, quem recebe, prioridade, correlação); o corpo é o Document, cujo conteúdo varia conforme o tipo de mensagem — pacs.008 para um crédito interbancário, pain.001 para uma iniciação de pagamento, camt.053 para um extrato.",
      },
      {
        type: "code",
        lang: "xml",
        text:
`<!-- Envelope típico (AppHdr + Document) -->
<Envelope>
  <AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
    <Fr><FIId><FinInstnId><BICFI>BANKBRSPXXX</BICFI></FinInstnId></FIId></Fr>
    <To><FIId><FinInstnId><BICFI>BANKBRRJXXX</BICFI></FinInstnId></FIId></To>
    <BizMsgIdr>MSG-2026-00001</BizMsgIdr>
    <MsgDefIdr>pacs.008.001.13</MsgDefIdr>
    <CreDt>2026-07-10T14:30:00Z</CreDt>
  </AppHdr>
  <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13">
    <FIToFICstmrCdtTrf>
      <GrpHdr>
        <MsgId>MSG-2026-00001</MsgId>
        <CreDtTm>2026-07-10T14:30:00Z</CreDtTm>
        <NbOfTxs>1</NbOfTxs>
        <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
      </GrpHdr>
      <CdtTrfTxInf>
        <PmtId>
          <InstrId>INSTR-001</InstrId>
          <EndToEndId>E12345678202607101430000000000001</EndToEndId>
        </PmtId>
        <!-- Debtor, Creditor, Amount ... -->
      </CdtTrfTxInf>
    </FIToFICstmrCdtTrf>
  </Document>
</Envelope>`,
      },
      { type: "heading", level: 3, text: "AppHdr (Business Application Header, head.001)" },
      {
        type: "paragraph",
        text:
          "O AppHdr é o \"envelope postal\": diz quem envia (Fr), quem recebe (To), qual é o identificador de negócio (BizMsgIdr), qual é a definição da mensagem transportada (MsgDefIdr, ex: pacs.008.001.13) e o carimbo de criação (CreDt). Nem todo ecossistema exige o AppHdr — o SPI, por exemplo, usa apenas o Document na fronteira SPI↔PSP —, mas em cenários de rede (SWIFT CBPR+) ele é obrigatório.",
      },
      { type: "heading", level: 3, text: "Document" },
      {
        type: "paragraph",
        text:
          "O Document é o corpo. O elemento raiz varia por mensagem (FIToFICstmrCdtTrf para pacs.008, CstmrCdtTrfInitn para pain.001, BkToCstmrStmt para camt.053). Todos compartilham a estrutura GrpHdr (metadata do lote) + N transações — o que muda são os campos específicos e as obrigatoriedades.",
      },

      // ── 3. XSD e versionamento ───────────────────────────────────
      { type: "heading", level: 2, text: "XSD e versionamento" },
      {
        type: "paragraph",
        text:
          "Cada mensagem ISO 20022 tem um XSD próprio e é identificada por um namespace canônico. Ler o namespace equivale a ler o tipo + versão da mensagem — não há campo \"versão\" separado.",
      },
      {
        type: "code",
        lang: "text",
        text:
`Formato do namespace:
  urn:iso:std:iso:20022:tech:xsd:{msgType}.{msgVar}.{msgId}.{version}

Exemplo (pacs.008 versão 13):
  urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13
                                  │    │   │  │
                                  │    │   │  └─ versão (2 dígitos)
                                  │    │   └──── message id (3 dígitos, quase sempre 001)
                                  │    └──────── variante (3 dígitos, quase sempre 001)
                                  └───────────── prefixo da família (pacs/pain/camt/head)`,
      },
      {
        type: "paragraph",
        text:
          "É comum encontrar várias versões coexistindo em produção. O motivo é que grupos diferentes (bancos, câmaras, redes) evoluem em ritmos distintos: um PSP pode ainda emitir pacs.008.001.09 enquanto outro já publica pacs.008.001.13, e a rede de destino precisa aceitar ambos até o cronograma de aposentadoria fechar. O Comparador de Versões do ISOLeaf existe justamente para diffar duas versões de uma mesma mensagem e mostrar quais campos foram adicionados, removidos ou tiveram cardinalidade/tipo alterados.",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "A versão faz parte do namespace, não é um atributo XML. Trocar pacs.008.001.09 por pacs.008.001.13 significa trocar o valor do xmlns do Document — o XSD, os elementos e as regras podem mudar entre uma versão e outra. Nunca assuma equivalência sem diff.",
      },

      // ── 4. Famílias de mensagem ──────────────────────────────────
      { type: "heading", level: 2, text: "Famílias de mensagem" },
      {
        type: "paragraph",
        text:
          "O prefixo de 4 letras no início do nome do XSD identifica a família. Cada família cobre um domínio funcional e agrupa mensagens semanticamente correlatas — dá para inferir o propósito olhando só o prefixo.",
      },
      {
        type: "table",
        headers: ["Família", "Domínio", "Propósito", "Exemplos suportados no ISOLeaf"],
        rows: [
          ["camt", "Cash management & reporting", "Extratos, notificações de débito/crédito, cancelamentos e consultas de status.", "camt.052, camt.053, camt.054, camt.056, camt.060"],
          ["pacs", "Payments clearing & settlement", "Instruções interbancárias — o \"cabo\" entre instituições financeiras liquidando ordens.", "pacs.002, pacs.004, pacs.008, pacs.009, pacs.028"],
          ["pain", "Payment initiation", "Cliente → banco: iniciação de crédito, débito, mandatos de Pix Automático e relatórios de status ao cliente.", "pain.001, pain.002, pain.009, pain.012"],
          ["head", "Business Application Header", "Envelope de roteamento comum a todas as famílias — quem envia, quem recebe, qual mensagem.", "head.001"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Regra prática: pain.* nasce no cliente e vive entre cliente↔banco. pacs.* vive entre bancos (interbancário). camt.* fecha o ciclo com informação (extratos, notificações, status). head.001 embrulha qualquer um deles quando a rede exige envelope de negócio.",
      },

      // ── 5. Referências oficiais ──────────────────────────────────
      { type: "heading", level: 2, text: "Referências oficiais" },
      {
        type: "paragraph",
        text:
          "As especificações canônicas moram nos sites das entidades reguladoras — não há substituto para os documentos originais quando você está fechando uma integração.",
      },
      {
        type: "list",
        items: [
          "[ISO 20022 oficial](https://www.iso20022.org/) — portal do padrão, mantido pelo grupo ISO 20022 Registration Management Group (RMG).",
          "[Catálogo de mensagens](https://www.iso20022.org/catalogue-messages) — lista completa de mensagens com XSD, exemplos e histórico de versões.",
          "[Pix / BCB](https://www.bcb.gov.br/estabilidadefinanceira/pix) — página do Pix no site do Banco Central do Brasil, com regulamentação e cronogramas.",
          "[Manual de Padrões para Iniciação do Pix (PDF)](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf) — manual técnico do BCB com formatos de EndToEndId, MsgId, ISPB, cardinalidades e cenários obrigatórios.",
          "[SWIFT CBPR+](https://www.swift.com/standards/iso-20022/iso-20022-standards) — programa CBPR+ da SWIFT: perfis de uso, guidelines e coexistência MT↔MX.",
        ],
      },
      {
        type: "callout",
        tone: "success",
        text:
          "O ISOLeaf traz os XSDs desses ecossistemas empacotados no /Schemas. Você não precisa baixar cada arquivo manualmente para validar uma mensagem — mas em caso de dúvida sobre uma regra específica, o documento oficial é sempre a fonte da verdade.",
      },
    ],
  },

  iso20022Roles: {
    id: "iso20022Roles",
    blocks: [
      // ── 1. Participantes do ecossistema Pix ──────────────────────
      { type: "divider" },
      { type: "heading", level: 2, text: "Participantes do ecossistema Pix" },
      {
        type: "paragraph",
        text:
          "No Pix, o fluxo interbancário é intermediado pelo Sistema de Pagamentos Instantâneos (SPI) operado pelo Banco Central. Os PSPs (Provedores de Serviço de Pagamento — bancos, fintechs, cooperativas) conversam com o SPI via mensagens ISO 20022; o SPI faz a liquidação em tempo real na conta Reservas Bancárias de cada participante.",
      },
      { type: "svg", text: PIX_CREDIT_TRANSFER_FLOW_SVG },
      { type: "heading", level: 3, text: "PSP Pagador" },
      {
        type: "paragraph",
        text:
          "O PSP que atende o cliente pagador. Recebe a ordem do usuário (via app, API, iniciador de pagamento), monta o pacs.008 com dados do pagador e do recebedor, e envia ao SPI. É responsável por débitos na conta do cliente e por observar bloqueios AML/CFT antes de encaminhar.",
      },
      { type: "heading", level: 3, text: "PSP Recebedor" },
      {
        type: "paragraph",
        text:
          "O PSP que atende o cliente recebedor. Recebe do SPI a instrução final (pacs.008) e credita a conta do cliente, normalmente notificando via camt.054. Também é o responsável por chaves DICT (CPF/CNPJ/e-mail/telefone/EVP) associadas ao seu cliente.",
      },
      { type: "heading", level: 3, text: "SPI/BCB" },
      {
        type: "paragraph",
        text:
          "O núcleo operado pelo Banco Central: recebe o pacs.008 do PSP Pagador, valida limites e formatos, executa a liquidação (débito na Reserva do pagador, crédito na Reserva do recebedor) e reencaminha a instrução ao PSP Recebedor. Emite pacs.002 de confirmação (ACCP/ACSC) ou pacs.004 em caso de retorno. As regras completas de formato (EndToEndId 32 chars, ISPB, MsgId) estão no Manual de Padrões para Iniciação do Pix (BCB), linkado na seção ISO 20022 deste guia.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Fluxo simplificado: usuário → PSP Pagador → SPI → PSP Recebedor → usuário. Toda a comunicação com o SPI usa ISO 20022 (pacs.008 na ida, pacs.002 na volta, pacs.004 em retornos, camt.054 para notificação de crédito).",
      },

      // ── 2. Participantes do ecossistema SWIFT CBPR+ ──────────────
      { type: "divider" },
      { type: "heading", level: 2, text: "Participantes do ecossistema SWIFT CBPR+" },
      {
        type: "paragraph",
        text:
          "CBPR+ (Cross-Border Payments and Reporting Plus) é o programa da SWIFT que migra pagamentos transfronteiriços do formato MT (blocos texto) para ISO 20022 (XML). O fluxo lógico é o mesmo dos MTs: cliente do banco ordenante ⇒ SWIFT ⇒ banco beneficiário — só muda o formato do fio.",
      },
      { type: "svg", text: MT103_DIRECT_FLOW_SVG },
      { type: "heading", level: 3, text: "Banco Ordenante (Debtor Agent)" },
      {
        type: "paragraph",
        text:
          "O banco do cliente pagador (Debtor). Recebe a ordem do cliente e emite um pacs.008 (ou pacs.009 em interbancário puro) para o banco beneficiário via a rede SWIFT. Preenche o UETR (Unique End-to-end Transaction Reference) — identificador global que acompanha a operação em todos os hops.",
      },
      { type: "heading", level: 3, text: "SWIFT (rede)" },
      {
        type: "paragraph",
        text:
          "Transporta as mensagens entre bancos e provê os serviços de rastreamento (gpi Tracker), diretório de BICs (SWIFTRef) e validação de conformidade (HVPS+ / CBPR+ guidelines). Em pagamentos com correspondente, a rede pode acomodar bancos intermediários (Intermediary Agent) que fazem a ponte quando não há conta direta entre ordenante e beneficiário.",
      },
      { type: "heading", level: 3, text: "Banco Beneficiário (Creditor Agent)" },
      {
        type: "paragraph",
        text:
          "O banco do cliente recebedor (Creditor). Recebe o pacs.008/pacs.009 via SWIFT, credita a conta do cliente e emite camt.054 (notificação) ou pacs.002 (confirmação para o remetente). Também pode gerar camt.053 para o extrato consolidado do dia.",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "Diferença conceitual entre Pix e CBPR+: no Pix, o SPI é uma câmara única (BCB) que efetivamente liquida. No CBPR+, a SWIFT é uma rede de mensageria — a liquidação acontece nos correspondentes, câmaras locais (ex: Fedwire, TARGET2) ou via cobertura. Por isso pacs.009 (cover payment) e o campo Intermediary Agent são especialmente relevantes no CBPR+.",
      },
    ],
  },

  glossary: {
    id: "glossary",
    blocks: [
      // ── Termos ISO 8583 / EMV ────────────────────────────────────
      { type: "heading", level: 3, text: "Termos ISO 8583 / EMV" },
      {
        type: "table",
        headers: ["Termo", "Definição"],
        rows: [
          ["ARC", "Authorization Response Code — código de resposta do emissor em formato EMV. Tag 8A. Mesmo valor do RC (bit 39) em TLV."],
          ["ARPC", "Application Response Cryptogram — criptograma gerado pelo emissor em resposta ao ARQC. Tag 91. Comprova que o emissor é legítimo."],
          ["ARQC", "Application Request Cryptogram — criptograma gerado pelo chip para autenticar a transação. Bit 55, tag 9F26. 8 bytes."],
          ["ATC", "Application Transaction Counter — contador sequencial no chip. Incrementa a cada transação. Usado na derivação da Session Key."],
          ["BIN", "Bank Identification Number — primeiros 6-8 dígitos do PAN. Identifica emissor e bandeira; usado para roteamento."],
          ["CNP", "Card Not Present — transação sem o cartão físico (ex: e-commerce). Maior risco de fraude."],
          ["CSU", "Card Status Update — bloco de dados usado no cálculo do ARPC Method 2. Permite atualizar o status do cartão."],
          ["CVV / CVC", "Card Verification Value/Code — código de 3 dígitos derivado do PAN, validade e chave do emissor. CVV1 na trilha, CVV2 impresso."],
          ["DDA", "Dynamic Data Authentication — autenticação offline onde o chip assina dados dinâmicos. Mais seguro que SDA."],
          ["EMV", "Europay, Mastercard, Visa — padrão global para transações com chip."],
          ["IAD", "Issuer Application Data — dados proprietários do emissor no Bit 55 (tag 9F10). Inclui o perfil de criptograma (CVN)."],
          ["IMK", "Issuer Master Key — chave raiz do emissor. Usada para derivar a ICC MK. Nunca sai do HSM em produção."],
          ["LLLVAR", "Campo variável com 3 dígitos de comprimento. Ex: '012HELLO WORLD!' (012 = comprimento)."],
          ["LLVAR", "Campo variável com 2 dígitos de comprimento. Ex: '12HELLO WORLD!' (12 = comprimento)."],
          ["MTI", "Message Type Indicator — 4 dígitos que identificam o tipo da mensagem ISO 8583. Ex: 0200 = Financial Request."],
          ["NII", "Network Interface Identifier — identificador de 2 bytes atribuído pela bandeira. Usado no TPDU para roteamento."],
          ["PAN", "Primary Account Number — número do cartão. Bit 2. Geralmente 13-19 dígitos."],
          ["PIN Block", "Bloco criptografado contendo o PIN. Bit 52. 8 bytes em formato ISO 9564."],
          ["PSN", "PAN Sequence Number — número de sequência do cartão. Diferencia múltiplos cartões com mesmo PAN. Usado na derivação da ICC MK."],
          ["RC", "Response Code — 2 caracteres no bit 39 indicando o resultado. '00' = aprovado, '05' = recusado."],
          ["RRN", "Retrieval Reference Number — referência única da transação. Bit 37. 12 caracteres. Usado para rastreamento e estorno."],
          ["SDA", "Static Data Authentication — autenticação offline simples. O chip assina dados estáticos do cartão."],
          ["Session Key", "Chave derivada do ICC MK + ATC. Única por transação. Usada para calcular o ARQC."],
          ["STAN", "System Trace Audit Number — número sequencial. Bit 11. 6 dígitos. Único por terminal por dia."],
          ["TLV", "Tag-Length-Value — estrutura de codificação no Bit 55. Cada campo tem Tag, Length e Value."],
          ["TPDU", "Transport Protocol Data Unit — prefixo de 5 bytes antes do MTI em conexões TCP. ID + NII origem + NII destino."],
          ["TVR", "Terminal Verification Results — 5 bytes (40 bits) no Bit 55 (tag 95). Cada bit é o resultado de uma verificação no terminal."],
          ["UN", "Unpredictable Number — 4 bytes aleatórios gerados pelo terminal para o cálculo do ARQC. Tag 9F37."],
          ["ZPK", "Zone PIN Key — chave de criptografia de PIN. Usada para decriptar o PIN Block recebido."],
        ],
      },

      // ── Termos ISO 20022 ────────────────────────────────────────
      { type: "heading", level: 3, text: "Termos ISO 20022" },
      {
        type: "table",
        headers: ["Termo", "Definição"],
        rows: [
          ["ACSC", "Accepted Settlement Completed — status ISO 20022 (pacs.002) indicando que a liquidação foi concluída. É o \"aprovado\" definitivo do mundo ISO 20022."],
          ["AppHdr", "Business Application Header (head.001) — envelope de roteamento do ISO 20022. Carrega Fr/To, BizMsgIdr, MsgDefIdr, CreDt. Obrigatório em CBPR+; opcional no Pix."],
          ["BIC", "Business Identifier Code — identificador SWIFT de 8 ou 11 caracteres (ex: BRASBRRJXXX). Nome corporativo do banco/instituição na rede. No ISO 20022 aparece como BICFI dentro de FinInstnId."],
          ["camt", "Cash Management — família de mensagens ISO 20022 para reporting: extratos (camt.053), notificações (camt.054), cancelamentos (camt.056) e consultas."],
          ["Document", "Elemento raiz do corpo de uma mensagem ISO 20022. Seu xmlns identifica tipo + versão (ex: urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13)."],
          ["head.001", "XSD do Business Application Header (AppHdr). Envelope comum a todas as famílias ISO 20022 — obrigatório em CBPR+ e outros contextos de rede."],
          ["IBAN", "International Bank Account Number — número de conta internacional (até 34 caracteres, começa com o código do país). Usado em SEPA, CBPR+ e T2. No Brasil não é obrigatório para Pix (que usa chave DICT ou dados bancários locais)."],
          ["MessageId / MsgId", "Identificador único da mensagem ISO 20022. Aparece no GrpHdr do Document e também no BizMsgIdr do AppHdr. Em Pix, o BCB especifica o formato (ISPB + data + sequencial)."],
          ["MT ↔ MX", "MT são mensagens SWIFT no formato legado (blocos texto \"tag:conteudo\"). MX é o apelido do formato ISO 20022 (XML). CBPR+ é o programa que mapeia MT→MX. O Comparador MT↔MX do ISOLeaf faz esse diff."],
          ["MTI → MX (equivalência)", "Não existe mapeamento direto de MTI (ISO 8583) para MX (ISO 20022) — são mundos separados. Conceitualmente, um 0100 de autorização de cartão joga o mesmo papel de uma pacs.008 de crédito, mas os fluxos, participantes e liquidação são distintos."],
          ["pacs", "Payments Clearing and Settlement — família de mensagens ISO 20022 para instruções interbancárias. Ex: pacs.008 (crédito), pacs.002 (status), pacs.004 (retorno), pacs.009 (crédito FI-a-FI)."],
          ["pain", "Payment Initiation — família de mensagens ISO 20022 para iniciação cliente↔banco. Ex: pain.001 (ordem de crédito), pain.002 (status), pain.009/pain.012 (mandatos de Pix Automático)."],
          ["PDNG", "Pending — status ISO 20022 (pacs.002) indicando que o processamento ainda está em andamento; a liquidação será notificada depois."],
          ["RJCT", "Rejected — status ISO 20022 (pacs.002) indicando que a mensagem foi rejeitada. Vem acompanhado de um StsRsn com o motivo da recusa."],
          ["targetNamespace", "Atributo do XSD que define o namespace do schema. É o valor exato que aparece no xmlns do Document da mensagem correspondente."],
          ["UETR", "Unique End-to-end Transaction Reference — UUID v4 gerado pelo banco ordenante em CBPR+/SWIFT gpi. Acompanha a transação em todos os hops e é a chave do rastreamento gpi Tracker."],
          ["XSD", "XML Schema Definition — arquivo que define a estrutura, os tipos e as regras de um XML ISO 20022. Cada mensagem tem seu XSD versionado; o Validador do ISOLeaf compara uma mensagem contra o XSD para apontar erros."],
        ],
      },
    ],
  },

  guides: {
    id: "guides",
    blocks: [
      // ── Guia amigável para iniciantes em Docker ──────────────────
      { type: "heading", level: 2, text: "Self-host com Docker — guia para iniciantes" },
      {
        type: "paragraph",
        text:
          "Cinco passos para rodar o ISOLeaf inteiro na sua máquina, mesmo se você nunca abriu um terminal antes. Nada de `git clone`, nada de compilar código, nada de editor. Só o Docker Desktop e um comando de uma linha.",
      },
      { type: "heading", level: 3, text: "O que você precisa" },
      {
        type: "list",
        items: [
          "**Docker Desktop** instalado — Windows, Mac ou Linux. É o único requisito.",
          "**Um navegador** — Chrome, Firefox, Safari ou Edge, qualquer versão recente.",
          "**Zero configuração adicional** — não precisa criar conta, gerar chaves, instalar Node, .NET, git ou qualquer coisa além do Docker.",
        ],
      },

      { type: "heading", level: 3, text: "Passo 1 — Instalar o Docker Desktop" },
      {
        type: "paragraph",
        text:
          "Baixe o instalador do [site oficial da Docker](https://www.docker.com/products/docker-desktop/) e siga o assistente até o fim (é o mesmo fluxo Next → Next → Instalar). Depois de instalar, abra o **Docker Desktop** — na primeira execução ele mostra uma tela de boas-vindas com aceite de termos.",
      },
      {
        type: "paragraph",
        text:
          "Confirme que está tudo pronto: na parte de baixo da janela do Docker Desktop deve aparecer o indicador verde com o texto **\"Engine running\"** (ou equivalente em português: \"Motor em execução\"). Se aparecer \"starting\" ou vermelho, aguarde alguns segundos ou reinicie o app.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "No Windows, o Docker Desktop pode pedir para habilitar o WSL 2 (Subsistema Windows para Linux) na primeira execução — aceite. É automático, só demora 1-2 minutos.",
      },

      { type: "heading", level: 3, text: "Passo 2 — Abrir um terminal e colar o comando" },
      {
        type: "paragraph",
        text:
          "**Onde encontrar o terminal:** no Windows, procure por \"PowerShell\" ou \"Prompt de Comando\" no menu Iniciar. No Mac, abra o app \"Terminal\" via Spotlight (⌘+Space, digite \"terminal\"). No Linux, ele geralmente já está no seu dock com o nome \"Terminal\" ou \"Console\".",
      },
      {
        type: "paragraph",
        text:
          "Cole o comando abaixo no terminal e pressione Enter. A primeira execução baixa a imagem (~200 MB), aguarde de 30s a 2 minutos dependendo da sua conexão. Depois disso, o container inicia em poucos segundos:",
      },
      {
        type: "code",
        lang: "bash",
        text:
          "docker run -d --name isoleaf -p 8080:8080 ghcr.io/isoleaf-io/isoleaf:latest",
      },
      {
        type: "paragraph",
        text:
          "Se aparecer uma linha longa com letras e números (o ID do container), deu certo. Se aparecer erro, veja a seção **Problemas comuns** no final deste guia.",
      },

      { type: "heading", level: 3, text: "Passo 3 — Abrir no navegador" },
      {
        type: "paragraph",
        text:
          "Abra o navegador e vá para **[http://localhost:8080](http://localhost:8080)**. A aplicação aparece imediatamente — é exatamente a mesma que você usa em isoleaf.dev, só que rodando 100% localmente.",
      },
      {
        type: "callout",
        tone: "success",
        text:
          "Diferença prática vs. a versão online: no self-hosted todas as features do Simulador TCP e da criptografia EMV ficam habilitadas — sessões TCP reais, ARQC/ARPC com IMK configurável, upload de XSDs ISO 20022 personalizados, tudo sem restrições.",
      },

      { type: "heading", level: 3, text: "Passo 4 (opcional) — Persistir XSDs entre atualizações" },
      {
        type: "paragraph",
        text:
          "Se você planeja fazer upload de XSDs ISO 20022 personalizados (via **Workspace → Schemas ISO 20022**) e quer que eles sobrevivam a `docker pull` de novas versões do ISOLeaf, use um volume Docker nomeado. Pare o container atual e rode com a flag `-v`:",
      },
      {
        type: "code",
        lang: "bash",
        text:
          "docker stop isoleaf\ndocker rm isoleaf\ndocker run -d --name isoleaf -p 8080:8080 \\\n  -v isoleaf-schemas:/app/data/schemas \\\n  ghcr.io/isoleaf-io/isoleaf:latest",
      },
      {
        type: "paragraph",
        text:
          "Na primeira vez, o Docker copia automaticamente o catálogo de 44 XSDs padrão para dentro do volume `isoleaf-schemas`. Uploads posteriores ficam ao lado deles e persistem entre reinícios e atualizações da imagem. Sem essa flag, uploads valem só pela vida do container atual (mas o catálogo padrão está sempre disponível de novo).",
      },

      { type: "heading", level: 3, text: "Passo 5 — Parar e atualizar" },
      {
        type: "paragraph",
        text:
          "**Parar o container** (não desinstala — só desliga):",
      },
      {
        type: "code",
        lang: "bash",
        text:
          "docker stop isoleaf\ndocker rm isoleaf",
      },
      {
        type: "paragraph",
        text:
          "**Atualizar para a versão mais recente:** puxe a nova imagem, remova o container antigo e rode de novo com o mesmo comando do Passo 2 (ou do Passo 4 se você usa volume):",
      },
      {
        type: "code",
        lang: "bash",
        text:
          "docker pull ghcr.io/isoleaf-io/isoleaf:latest\ndocker stop isoleaf && docker rm isoleaf\ndocker run -d --name isoleaf -p 8080:8080 ghcr.io/isoleaf-io/isoleaf:latest",
      },

      { type: "heading", level: 3, text: "Problemas comuns" },
      {
        type: "callout",
        tone: "warning",
        text:
          "**Erro \"port is already allocated\" ou \"bind: address already in use\"** — a porta 8080 já está sendo usada por outro programa (talvez outra instância do próprio ISOLeaf, ou um servidor local). Troque a porta local pra 8081 (ou qualquer outra livre): `-p 8081:8080` no comando. Depois abra `http://localhost:8081` em vez de 8080.",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "**Docker Desktop não inicia / aparece \"Docker daemon is not running\"** — reinicie o Docker Desktop pelo app (menu → Restart). Se persistir, reinicie a máquina e abra o Docker Desktop antes de qualquer outra coisa. Em último caso, reinstale o Docker Desktop pelo instalador oficial.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "**Como saber que o container está rodando?** Rode `docker ps` no terminal — se aparecer uma linha com `isoleaf` e `Up X minutes`, tudo certo. Se não aparecer, rode `docker ps -a` (com `-a`) para ver containers parados e reveja o output do `docker run` para eventuais erros.",
      },

      { type: "divider" },

      { type: "heading", level: 2, text: "Arquitetura do ISOLeaf" },
      {
        type: "paragraph",
        text:
          "O ISOLeaf é uma aplicação standalone que roda inteiramente na sua máquina. Nenhum dado sai do seu ambiente.",
      },
      { type: "svg", text: ISOHUB_ARCHITECTURE_SVG },
      { type: "heading", level: 3, text: "Segurança" },
      { type: "callout", tone: "success", text: "Dados ficam na sua máquina — zero telemetria, sem conexões externas além das que você configurar." },
      { type: "callout", tone: "warning", text: "Sem autenticação JWT — acesso livre em localhost. Se expor a porta 8080 na rede (0.0.0.0), qualquer máquina da rede pode acessar sem senha. Use apenas em redes confiáveis ou com firewall." },
      { type: "heading", level: 3, text: "Dados armazenados localmente" },
      {
        type: "list",
        items: [
          "Workspace (IMK, ZPK, configurações): arquivo JSON local",
          "Templates: localStorage do browser",
          "Histórico EMV: memória da sessão (limpo ao reiniciar)",
        ],
      },

      // ── Primeiros passos — visão geral dos módulos ─────────────────
      { type: "heading", level: 2, text: "Primeiros passos — conhecendo os módulos" },
      {
        type: "paragraph",
        text:
          "O ISOLeaf é organizado em seis módulos. Antes de mergulhar em um guia específico, vale conhecer rapidamente o que cada um faz.",
      },

      { type: "heading", level: 3, text: "Parser" },
      {
        type: "paragraph",
        text:
          "O módulo mais usado. Cole qualquer mensagem ISO 8583 (ASCII wire ou binary-hex, com ou sem TPDU) e veja todos os campos decodificados automaticamente. Clique em qualquer campo para copiar, revelar valores mascarados ou navegar para outros módulos.",
      },
      {
        type: "image",
        src: "/screenshots/parse1.png",
        alt: "Tela do Parser",
        caption: "Parser — decodifica qualquer mensagem ISO 8583",
      },

      { type: "heading", level: 3, text: "Builder" },
      {
        type: "paragraph",
        text:
          "Gera mensagens ISO 8583 completas sem precisar conhecer cada campo. Selecione o contexto (papel, bandeira, canal, tipo de transação) e o ISOLeaf preenche automaticamente os campos corretos — incluindo o Bit 55 com ARQC real quando a IMK está configurada no Workspace.",
      },
      {
        type: "image",
        src: "/screenshots/builder2.png",
        alt: "Builder com mensagem gerada",
        caption: "Builder — mensagem gerada com campos preenchidos automaticamente",
      },
      {
        type: "image",
        src: "/screenshots/builder3.png",
        alt: "Painel de adição de bits adicionais no Builder",
        caption: "Builder — adicione bits extras à mensagem gerada",
      },

      { type: "heading", level: 3, text: "Simulador" },
      {
        type: "paragraph",
        text:
          "Suba um Rebatedor para receber mensagens TCP e responder automaticamente — simulando um autorizador/emissor. Ou use o Injetor para enviar mensagens ao seu sistema e acompanhar as respostas em tempo real.",
      },
      {
        type: "image",
        src: "/screenshots/simulator.png",
        alt: "Tela do Simulador",
        caption: "Simulador — 4 sessões ativas com mensagem rebatida com sucesso",
      },

      { type: "heading", level: 3, text: "Dados EMV" },
      {
        type: "paragraph",
        text:
          "Seis tabs para trabalhar com criptografia EMV: Parse Bit 55, Validate ARQC, Generate ARQC, Generate ARPC, Build Response e Full Flow.",
      },
      {
        type: "image",
        src: "/screenshots/emv1.png",
        alt: "Tela de Dados EMV",
        caption: "Dados EMV — Parse Bit 55 com tags decodificadas",
      },

      { type: "heading", level: 3, text: "Cartão de teste" },
      {
        type: "paragraph",
        text:
          "Gera PANs válidos com trilhas e CVV por bandeira para usar em testes sem precisar de cartões reais.",
      },
      {
        type: "image",
        src: "/screenshots/testcard.png",
        alt: "Tela de Cartão de teste",
        caption: "Cartão de teste — gera dados válidos por bandeira",
      },

      { type: "heading", level: 3, text: "Workspace" },
      {
        type: "paragraph",
        text:
          "Configure valores padrão (Terminal ID, Merchant ID, NIIs) e chaves criptográficas (IMK, ZPK) que são usadas automaticamente pelo Builder e pelo Simulador.",
      },
      {
        type: "image",
        src: "/screenshots/workspace.png",
        alt: "Tela do Workspace",
        caption: "Workspace — configurações e chaves criptográficas",
      },
      {
        type: "image",
        src: "/screenshots/workspace2.png",
        alt: "Templates salvos no Workspace",
        caption: "Workspace — templates salvos para reutilização no Builder",
      },

      { type: "divider" },

      // ── Tour ISO 20022 ────────────────────────────────────────────
      { type: "heading", level: 2, text: "Primeiros passos — módulos ISO 20022" },
      {
        type: "paragraph",
        text:
          "O bloco ISO 20022 do ISOLeaf reúne oito módulos que cobrem o ciclo completo de leitura, produção e visualização de mensagens. A ideia desta seção é apresentar cada um em uma linha para você saber para onde ir; o passo-a-passo profundo dos casos mais comuns vem no bloco \"Guias práticos — ISO 20022\" mais adiante.",
      },

      { type: "heading", level: 3, text: "Parser XML" },
      {
        type: "paragraph",
        text:
          "Cole qualquer XML ISO 20022 (com ou sem AppHdr) e veja a árvore de campos decodificada. O parser detecta a família e a versão pelo namespace, aplica o XSD certo automaticamente e traz um resumo semântico (tipo de operação, atores, valor, chave Pix quando existir). Botão \"Gerar Return\" produz a mensagem de resposta correlata (pacs.008 → pacs.002/pacs.004).",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/parser-xml.png",
        alt: "Tela do Parser XML ISO 20022",
        caption: "Parser XML — árvore de campos decodificada + resumo semântico",
      },

      { type: "heading", level: 3, text: "Referência de Campos" },
      {
        type: "paragraph",
        text:
          "Árvore navegável da estrutura de qualquer mensagem suportada. Aba \"Por mensagem\" mostra o XSD inteiro em formato de tree; aba \"Busca por campo\" cruza um nome (ex: EndToEndId, Dbtr, RmtInf) contra todas as versões e famílias, útil para entender onde um campo aparece em diferentes tipos e como sua cardinalidade evoluiu entre versões.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/referencia-campos.png",
        alt: "Tela da Referência de Campos ISO 20022",
        caption: "Referência de Campos — árvore por mensagem + busca cruzada",
      },

      { type: "heading", level: 3, text: "Validador XSD + Comparador de Versões" },
      {
        type: "paragraph",
        text:
          "O Validador (botão dentro do Parser) roda o XML contra o XSD e devolve erros com mensagens curtas em português — o texto verboso do parser .NET é reformulado por família de erro (elemento inválido, valor fora do facet, cardinalidade errada, namespace errado). O Comparador de Versões diffa duas versões do mesmo tipo (ex: pacs.008.001.09 vs pacs.008.001.13) listando campos adicionados, removidos e alterados; quando aberto a partir de uma mensagem específica, filtra o diff pelos campos que a sua mensagem usa.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/validador-comparador.png",
        alt: "Tela do Validador XSD e do Comparador de Versões",
        caption: "Validador + Comparador — erros de schema traduzidos e diff entre versões",
      },

      { type: "heading", level: 3, text: "Builder" },
      {
        type: "paragraph",
        text:
          "Compõe mensagens ISO 20022 completas a partir de um Ecossistema → Cenário → Versão. Suporta 5 ecossistemas: **Brazilian Pix** (SPI/BCB, com formatos regulamentados de EndToEndId, ISPB, TxId), **SEPA** (crédito e status na área do euro), **SWIFT CBPR+** (cover payments, retornos, cancelamentos, status inquiry), **TARGET/T2** (câmara do Eurosistema) e **Generic** (para explorar qualquer XSD carregado). O split Formulário/XML deixa ver a mensagem sendo escrita em tempo real; abaixo do breakpoint md a interface vira abas para caber no mobile.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/builder.png",
        alt: "Tela do Builder ISO 20022 com formulário e XML lado a lado",
        caption: "Builder — cascata Ecossistema → Cenário → Versão com split Formulário/XML",
      },

      { type: "heading", level: 3, text: "QR Code Pix" },
      {
        type: "paragraph",
        text:
          "Decodifica e gera payloads EMV do Pix Copia e Cola (BR Code). Aceita QR estático (chave + valor) e dinâmico (POI com TXID). Serve tanto para inspecionar um QR alheio quanto para produzir QRs de teste — com validação inline dos campos obrigatórios do padrão BR Code.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/qrcode-pix.png",
        alt: "Tela do módulo QR Code Pix",
        caption: "QR Code Pix — decode e geração de BR Code (Pix Copia e Cola)",
      },

      { type: "heading", level: 3, text: "Flow Visualizer" },
      {
        type: "paragraph",
        text:
          "Diagrama de sequência multi-mensagem. Quatro abas de protocolo (Brazilian Pix, SWIFT CBPR+ MX, SWIFT CBPR+ MT, ISO 8583) — cada uma com seu conjunto de fluxos pré-definidos (crédito direto, cover payment, retorno, cancelamento, transferência com stand-in, etc.). Clicar em uma seta abre o payload correspondente em uma linha abaixo, com parse + botão de \"abrir no Parser\" quando o step for XML.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/flow-visualizer.png",
        alt: "Tela do Flow Visualizer com diagrama de sequência",
        caption: "Flow Visualizer — sequência multi-mensagem por protocolo",
      },

      { type: "heading", level: 3, text: "Parser MT" },
      {
        type: "paragraph",
        text:
          "Parseia mensagens SWIFT MT (formato legado, blocos {1:...}{2:...}{3:...}{4:...}). Reconhece MT103 (crédito de cliente), MT202 e MT202COV (crédito interbancário e cover). Complementa o Comparador MT↔MX quando a integração precisa suportar os dois formatos durante a migração CBPR+.",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/parser-mt.png",
        alt: "Tela do Parser MT com mensagem SWIFT decodificada",
        caption: "Parser MT — decodifica MT103/MT202/MT202COV bloco a bloco",
      },

      { type: "heading", level: 3, text: "Comparador MT↔MX" },
      {
        type: "paragraph",
        text:
          "Diffa uma mensagem MT contra uma MX equivalente (ex: MT103 vs pacs.008). Modo A gera a MX a partir do MT via o Builder e mostra os dois lado a lado; Modo B compara duas mensagens já existentes campo a campo. Cada linha do diff traz um nível de confiança (Automatic quando o mapeamento CBPR+ é direto, Ambiguous quando há mais de uma opção equivalente, NoMapping quando o campo não tem correspondente no outro formato).",
      },
      {
        type: "image",
        src: "/screenshots/iso20022/comparador-mt-mx.png",
        alt: "Tela do Comparador MT↔MX com diff entre MT103 e pacs.008",
        caption: "Comparador MT↔MX — diff campo a campo com níveis de confiança",
      },

      { type: "heading", level: 3, text: "Workspace" },
      {
        type: "paragraph",
        text:
          "O Workspace consolida a configuração persistente do ISOLeaf. Abriu três abas:",
      },
      {
        type: "list",
        items: [
          "**Configuração** — valores padrão aplicados ao Builder e ao Simulador: identificação da instituição, ISPB, BIC, contas-teste, chaves criptográficas (IMK, ZPK) do lado ISO 8583. Um lugar só, aplicado em todos os módulos.",
          "**Templates** — mensagens salvas e reutilizáveis. Cada template guarda contexto + campos preenchidos; um clique traz de volta o estado exato do Builder. Aceita importação/exportação em JSON para compartilhar entre máquinas.",
          "**Schemas ISO 20022** — inventário dos XSDs que o Agent conhece, agrupado por família (camt/head/pacs/pain). Um botão de upload permite adicionar um novo XSD; o schema é validado, gravado em disco e o registro é recarregado no ato — sem restart. Sprint 10.1 introduziu persistência híbrida via volume Docker: o volume `schemas-data` (montado em `/app/data/Schemas`) preserva os XSDs importados entre reinícios do container, enquanto o catálogo base continua embutido na imagem.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Após um upload de XSD, a Referência, o Comparador e o Builder passam a enxergar a nova versão imediatamente — o ReferenceService é recarregado em cadeia pelo SchemaUploadService.",
      },

      { type: "divider" },

      // ── Guias práticos ────────────────────────────────────────────
      { type: "heading", level: 2, text: "Guias práticos" },
      {
        type: "paragraph",
        text:
          "Passo a passo dos fluxos mais comuns no ISOLeaf. Cada guia parte de um cenário concreto e mostra os cliques exatos.",
      },

      {
        type: "heading",
        level: 3,
        text: "Parsear uma mensagem ISO 8583",
        subtitle: "Cenário: você recebeu uma mensagem ISO 8583 e precisa entender o que ela contém.",
      },
      {
        type: "image",
        src: "/screenshots/parse1.png",
        alt: "Tela do Parser com mensagem ISO 8583 decodificada",
        caption: "Parser — cole uma mensagem e veja todos os campos decodificados",
      },
      {
        type: "image",
        src: "/screenshots/parse2.png",
        alt: "Parser com mensagem parseada",
        caption: "Parser — mensagem decodificada com todos os campos",
      },
      {
        type: "image",
        src: "/screenshots/parse3.png",
        alt: "Parser exibindo o bitmap",
        caption: "Parser — visualização dos bits ativos no bitmap",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra o módulo **Parser**.",
          "Cole a mensagem no campo de texto (aceita ASCII wire, binary-hex ou com TPDU).",
          "Clique **Parsear →** ou pressione `Ctrl+Enter`. O ISOLeaf detecta o formato automaticamente.",
        ],
      },
      { type: "callout", tone: "info", text: "Colar uma mensagem já dispara o parse automaticamente (300 ms de debounce)." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Gerar uma mensagem ISO 8583",
        subtitle: "Cenário: você precisa de uma mensagem pronta para testar uma integração.",
      },
      {
        type: "image",
        src: "/screenshots/builder2.png",
        alt: "Builder com mensagem gerada e campos preenchidos",
        caption: "Builder — selecione o contexto e gere a mensagem completa",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra o módulo **Builder**.",
          "Selecione **MTI**, **Papel**, **Bandeira**, **Canal** e **Tipo de transação**.",
          "Clique **Gerar →**. Os campos são preenchidos automaticamente.",
          "Edite os valores que precisar na tabela.",
          "Copie a mensagem gerada (ASCII wire ou binary-hex).",
        ],
      },
      { type: "callout", tone: "info", text: "Configure a IMK no **Workspace** para gerar **ARQC** real em vez de aleatório." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Validar ARQC de uma transação",
        subtitle: "Cenário: você recebeu uma mensagem com Bit 55 e quer confirmar que o criptograma é legítimo.",
      },
      {
        type: "image",
        src: "/screenshots/emv2.png",
        alt: "Tela de validação de ARQC no módulo Dados EMV",
        caption: "Dados EMV — Validação de ARQC com resultado detalhado",
      },
      { type: "paragraph", text: "Pré-requisito: ter o Bit 55 em hex e a IMK do emissor." },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra **Dados EMV** → aba **Validate ARQC**.",
          "Cole o Bit 55 em hex.",
          "Informe a Issuer Master Key (**IMK-AC**).",
          "Informe o **PAN** e o **PAN Sequence Number** (geralmente `00`).",
          "Selecione o perfil da bandeira.",
          "Clique **Validar ARQC**.",
        ],
      },
      { type: "callout", tone: "info", text: "Use **Validar no EMV** diretamente no **Parser** — o PAN e a bandeira são preenchidos automaticamente após parsear uma mensagem com Bit 55." },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Simular um autorizador (Rebatedor)",
        subtitle: "Cenário: você tem um terminal/sistema que envia transações e quer simular o autorizador.",
      },
      {
        type: "image",
        src: "/screenshots/simulator.png",
        alt: "Tela do Simulador com 4 sessões rebatedoras ativas",
        caption: "Simulador — 4 sessões ativas com mensagem rebatida com sucesso",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra **Simulador** e clique **+ Nova sessão**.",
          "Configure: **Porta TCP** (ex.: `9100`), **Papel** = `Emissor`, **RC padrão** = `00`, **Resposta automática** ligada.",
          "Clique **Confirmar**.",
          "Aponte seu terminal para `localhost:9100`.",
          "O ISOLeaf responde automaticamente a cada mensagem recebida.",
        ],
      },
      { type: "callout", tone: "info", text: "Clique no ícone de log no card da sessão para filtrar o log apenas dessa sessão." },

      { type: "heading", level: 4, text: "Rebatedor (Listener)" },
      {
        type: "paragraph",
        text:
          "Abre uma porta TCP local e aguarda conexões. Quando recebe uma mensagem, responde automaticamente conforme as configurações da sessão.",
      },
      { type: "paragraph", text: "Campos de configuração:" },
      {
        type: "list",
        items: [
          "**Porta TCP**: porta local onde vai escutar (ex.: `9100`).",
          "**Papel**: define o contexto da resposta automática — `Adquirente` (simula uma credenciadora), `Bandeira` (simula a rede) ou `Emissor` (simula o banco emissor, mais comum).",
          "**RC padrão**: código de resposta padrão (`00` = aprovar tudo).",
          "**Modo TPDU**: como tratar o prefixo TPDU — `Opcional` (aceita com ou sem), `Obrigatório` (rejeita sem TPDU) ou `Remover` (strip antes de processar).",
          "**MTI desconhecido**: como responder a MTIs não mapeados — `Derivar` (tenta `0100`→`0110` automaticamente), `Rejeitar` (não responde), `Ecoar` (responde com o mesmo MTI) ou `Customizado` (MTI específico).",
          "**Resposta automática**: toggle para ligar/desligar.",
          "**Validar ARQC**: verifica o criptograma EMV (requer IMK configurada no **Workspace**).",
        ],
      },
      {
        type: "image",
        src: "/screenshots/new_session.png",
        alt: "Formulário de nova sessão do Simulador",
        caption: "Criação de sessão — configurações do Rebatedor incluindo modo de framing (Length prefix)",
      },

      { type: "heading", level: 4, text: "Configurar resposta EMV (Rebatedor Emissor)" },
      {
        type: "paragraph",
        text:
          "No modo Emissor, o Rebatedor pode ser configurado para definir como o Bit 55 é tratado na resposta. Clique no botão ⚙️ no card da sessão para acessar as opções.",
      },
      {
        type: "image",
        src: "/screenshots/simulator2.png",
        alt: "Configuração da resposta EMV no Rebatedor Emissor",
        caption: "Config EMV — escolha entre Echo (cópia do Bit 55) ou Gerar ARPC (simular emissor real)",
      },
      {
        type: "list",
        items: [
          "**Echo** (padrão): copia o Bit 55 recebido diretamente na resposta. Funciona com qualquer formato, incluindo mensagens com header proprietário antes do TLV.",
          "**Gerar ARPC**: deriva o ARPC usando a IMK e retorna o Bit 55 de resposta com as tags `91` e `8A`. Permite configurar o tamanho do header proprietário (se houver) e a IMK (usa o Workspace se não informada).",
          "**Validar ARQC**: quando ativado junto com **Gerar ARPC**, valida o ARQC antes de gerar a resposta. ARQC inválido resulta em RC=05 na resposta.",
        ],
      },

      { type: "heading", level: 4, text: "Injetor (Connector)" },
      {
        type: "paragraph",
        text:
          "Conecta a um sistema TCP externo e envia mensagens. Use para testar seu autorizador enviando transações e verificando as respostas.",
      },
      { type: "paragraph", text: "Campos de configuração:" },
      {
        type: "list",
        items: [
          "**Host destino**: IP ou hostname do sistema alvo.",
          "**Porta destino**: porta TCP do sistema alvo (ex.: `8583`).",
          "**Mensagem**: a ISO 8583 a enviar (hex ou ASCII wire).",
          "**Modo contínuo**: envia em loop (1 msg/s). Marque **Variar identificadores** para STAN/RRN/DateTime mudarem a cada envio; **Variar valor** para Amount aleatório dentro de um range.",
        ],
      },

      { type: "heading", level: 4, text: "Log ao vivo" },
      {
        type: "paragraph",
        text:
          "Mostra em tempo real todas as mensagens recebidas e enviadas pelos Rebatedores. Clique no ícone de log em cada sessão para filtrar apenas aquela sessão.",
      },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Injetar mensagens (Injetor)",
        subtitle: "Cenário: você tem um autorizador rodando e quer enviar transações para testá-lo.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra **Simulador** → seção **Injetor**.",
          "Configure **Host destino** e **Porta destino** (ex.: `localhost:8583`).",
          "Cole a mensagem ISO 8583 no campo de texto (pode usar uma gerada pelo **Builder**).",
          "Clique **Injetar →** para enviar uma única mensagem ou **Iniciar contínuo** para loop (1 msg/s).",
        ],
      },
      { type: "callout", tone: "info", text: "Marque **Variar identificadores** para que cada envio tenha STAN/RRN diferente — evita rejeição por duplicata." },

      { type: "divider" },

      { type: "heading", level: 2, text: "As 6 tabs do módulo Dados EMV" },
      {
        type: "paragraph",
        text:
          "O módulo **Dados EMV** organiza os fluxos de criptografia em seis tabs encadeáveis. Você pode usar cada uma isolada ou combiná-las no **Full Flow**.",
      },

      { type: "heading", level: 4, text: "Parse Bit 55" },
      {
        type: "paragraph",
        text:
          "Cole um Bit 55 em hex e veja todas as tags BER-TLV decodificadas. Suporta parse parcial — se encontrar uma tag inválida, mostra o que conseguiu parsear até aquele ponto.",
      },
      {
        type: "image",
        src: "/screenshots/emv1.png",
        alt: "Parse Bit 55 — tela inicial sem dados",
        caption: "Parse Bit 55 — cole o Bit 55 em hex para decodificar as tags",
      },

      { type: "heading", level: 4, text: "Validate ARQC" },
      {
        type: "paragraph",
        text:
          "Valide se um ARQC recebido é legítimo. Informe o Bit 55, a IMK e o PAN. O ISOLeaf recalcula a cadeia de derivação e compara com o ARQC recebido.",
      },
      {
        type: "image",
        src: "/screenshots/emv3.png",
        alt: "Validate ARQC — tela de validação",
        caption: "Validate ARQC — informe o Bit 55, IMK e PAN para validar",
      },

      { type: "heading", level: 4, text: "Generate ARQC" },
      {
        type: "paragraph",
        text:
          "Gere um ARQC real a partir de dados de transação. Útil para criar dados de teste realistas ou verificar sua implementação de derivação.",
      },
      {
        type: "image",
        src: "/screenshots/emv4.png",
        alt: "Generate ARQC — tela de geração",
        caption: "Generate ARQC — gere um ARQC real a partir dos dados da transação",
      },

      { type: "heading", level: 4, text: "Generate ARPC" },
      {
        type: "paragraph",
        text:
          "Gere o ARPC (resposta do emissor) a partir do ARQC recebido. Suporta **Method 1** (Visa/Elo) e **Method 2** (Mastercard).",
      },
      {
        type: "image",
        src: "/screenshots/emv5.png",
        alt: "Generate ARPC — tela de geração da resposta",
        caption: "Generate ARPC — gere a resposta do emissor (Method 1 ou 2)",
      },

      { type: "heading", level: 4, text: "Build Response" },
      {
        type: "paragraph",
        text:
          "Monte o Bit 55 de resposta (tags `91` + `8A`) que o emissor deve retornar na mensagem de resposta.",
      },
      {
        type: "image",
        src: "/screenshots/emv6.png",
        alt: "Build Response — montar Bit 55 de resposta",
        caption: "Build Response — monte o Bit 55 de resposta com ARPC e ARC",
      },

      { type: "heading", level: 4, text: "Full Flow" },
      {
        type: "paragraph",
        text:
          "Executa os 4 passos em sequência automática — **Parse Bit 55** → **Validate ARQC** → **Generate ARPC** → **Build Response**. O fluxo completo do emissor em um único clique.",
      },
      {
        type: "image",
        src: "/screenshots/emv7.png",
        alt: "Full Flow EMV com resultado completo",
        caption: "Full Flow — ARQC validado, ARPC gerado, Bit 55 montado",
      },

      { type: "divider" },

      {
        type: "heading",
        level: 3,
        text: "Full Flow EMV",
        subtitle: "Cenário: receber uma transação com chip e responder corretamente com ARPC.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra **Dados EMV** → aba **Full Flow**.",
          "Preencha: **Bit 55** hex da mensagem recebida, **IMK-AC**, **PAN**, **PAN Sequence Number**, **Auth Response Code**.",
          "Clique **Run Full EMV Flow**.",
          "O ISOLeaf parseia o Bit 55, valida o ARQC, gera o ARPC e monta o Bit 55 de resposta (tags `91` + `8A`).",
          "Copie o Bit 55 de resposta para incluir na sua `0110` / `0210`.",
        ],
      },

      { type: "divider" },

      // ── Guias práticos — ISO 20022 ───────────────────────────────
      { type: "heading", level: 2, text: "Guias práticos — ISO 20022" },
      {
        type: "paragraph",
        text:
          "Três fluxos cobrem 90% do que analistas fazem no dia a dia com o bloco ISO 20022 do ISOLeaf: montar uma mensagem multi-ecossistema no Builder, ler um diagrama de sequência no Flow Visualizer e entender o relatório do Comparador MT↔MX. Cada guia parte do zero e assume que você acabou de abrir o módulo.",
      },

      // ── Guia: Builder multi-ecossistema ──────────────────────────
      {
        type: "heading",
        level: 4,
        text: "Builder multi-ecossistema",
        subtitle: "Cenário: você precisa gerar uma mensagem ISO 20022 pronta para testar uma integração — sem escrever XML na mão.",
      },
      {
        type: "paragraph",
        text:
          "O Builder trabalha em uma cascata Ecossistema → Cenário → Versão → Gerar. Cada ecossistema traz seu próprio conjunto de cenários (com placeholders realistas de nomes, contas, BICs) e obriga apenas os campos que a rede em questão exige — o que evita a explosão de campos opcionais que o XSD puro do ISO 20022 traz por padrão.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra o módulo **Builder**.",
          "Selecione um **Ecossistema**. As opções são: **Brazilian Pix** (regras do SPI/BCB), **SEPA** (área do euro), **SWIFT CBPR+** (cross-border com BIC), **TARGET/T2** (câmara do Eurosistema) e **Generic** (permite escolher qualquer XSD carregado, sem regras de negócio locais).",
          "Selecione um **Cenário**. O cenário determina o tipo de mensagem (pacs.008, pain.001, pacs.004, camt.056, etc.) e traz um conjunto de defaults por ecossistema — Debtor, Creditor, agentes intermediários, códigos de propósito.",
          "Selecione uma **Versão**. Só as versões suportadas pelo cenário aparecem — para pacs.008 no Pix, por exemplo, o Builder traz `001.13` como padrão (a versão vigente no SPI hoje). Se você precisar de uma versão antiga para testar compatibilidade, escolha na lista.",
          "Clique **↺ Dados de teste** para preencher automaticamente Debtor/Creditor com nomes e contas de um gerador de dados fake do ecossistema (locale pt_BR para Pix, de/en para SEPA/CBPR+/T2).",
          "Clique **Gerar**. O Builder chama o backend, monta o Document e renderiza o XML em tempo real ao lado do formulário.",
          "Edite qualquer campo diretamente no formulário — o XML da direita reage. Campos regulados (EndToEndId 32 chars no Pix, UETR UUID v4 no CBPR+) têm um botão **⟳** para regerar o valor conforme o formato oficial.",
          "Use a barra de busca no topo do formulário para promover um campo opcional. O Builder inclui automaticamente os ancestrais (adicionar `PmtId/InstrId` abre `PmtId`, ganhando o `InstrId` dentro).",
          "**Copiar XML** para colar no seu integrador ou **Abrir no Parser** para inspecionar imediatamente o resultado com validação.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Diferença entre os 5 ecossistemas. Brazilian Pix impõe o Manual de Padrões do BCB (formatos regulados de EndToEndId, ISPB no lugar de BIC). SEPA joga com IBAN e códigos de propósito da área do euro. SWIFT CBPR+ exige BIC + UETR e traz cover payments (pacs.009). TARGET/T2 é a variante europeia do interbancário de alto valor. Generic serve para explorar qualquer XSD (inclusive schemas custom que você fez upload no Workspace) sem regras adicionais — útil para testes de conformidade puramente estrutural.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Como interpretar o XML gerado. O topo do Document define o namespace (identifica tipo + versão). GrpHdr traz os metadados do lote (MsgId, CreDtTm, NbOfTxs, SttlmInf). O corpo específico da mensagem (FIToFICstmrCdtTrf em pacs.008, CstmrCdtTrfInitn em pain.001) contém uma ou mais transações — cada transação tem sua PmtId (identificadores), o par Debtor/Creditor com seus agentes e o RmtInf com as informações da remessa.",
      },

      { type: "divider" },

      // ── Guia: Flow Visualizer ────────────────────────────────────
      {
        type: "heading",
        level: 4,
        text: "Flow Visualizer",
        subtitle: "Cenário: você precisa entender como uma sequência de mensagens flui entre os participantes de um protocolo.",
      },
      {
        type: "paragraph",
        text:
          "O Flow Visualizer desenha diagramas de sequência clássicos: colunas para cada ator, setas verticais para cada mensagem, uma linha do tempo descendo. É útil tanto para aprender um protocolo novo quanto para depurar uma integração real — cada seta abre o payload correspondente e você consegue ver o XML que efetivamente circula em cada hop.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra **Flow Visualizer**. O topo da tela traz quatro abas de protocolo: **🇧🇷 Pix** (BR), **⚡ CBPR+ MX** (SWIFT XML), **📄 CBPR+ MT** (SWIFT legado) e **💳 ISO 8583** (mundo de cartão).",
          "Escolha a aba do protocolo que quer estudar. Cada aba tem seu próprio catálogo de fluxos e sua própria coluna de atores — no Pix são \"Pagador → PSP Pagador → SPI/BCB → PSP Recebedor → Recebedor\"; no CBPR+ MX é \"Banco Originador → SWIFT/Correspondente → Banco Intermediário → Banco Beneficiário\".",
          "Escolha o **Fluxo** no dropdown do topo. Exemplos por aba: no Pix — Transferência, Transferência com return, Open Finance, Rejeitada, Pix Automático; no CBPR+ — Direct Payment, Cover Payment, Return, Cancellation, Status Inquiry.",
          "Clique **Gerar Fluxo**. O ISOLeaf produz mensagens fictícias válidas para cada step do fluxo escolhido e desenha o diagrama.",
          "Interprete o diagrama. Cada seta é um step; o rótulo em cima da seta identifica a mensagem (ex: `pacs.008.001.13`). Setas contínuas são hops principais; **setas tracejadas** representam relay do BCB/correspondente; **setas vermelhas** representam timeout (issuer não respondeu, stand-in).",
          "Clique em uma seta. Uma segunda linha aparece abaixo mostrando o **payload XML** desse step + um **resumo** parseado ao lado. Se o step for MT (legado) ou ISO 8583, o painel adaptativo troca para o formato correto.",
          "Use **Abrir no Parser** dentro do painel do step para aprofundar a inspeção — o Parser abre com o XML já preenchido e pronto para validação.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Atores e setas — leitura rápida. Cada coluna vertical é um ator (PSP, banco, SPI, network). Uma seta da coluna A para a coluna B representa uma mensagem indo de A para B. A ordem descendente das setas é a linha do tempo do fluxo. Um step \"clicável\" é qualquer seta — sempre corresponde a um payload real gerado (não é ilustração vazia).",
      },
      {
        type: "callout",
        tone: "warning",
        text:
          "O diagrama é escalado automaticamente para caber na largura disponível — em mobile ele reduz sem exigir arraste horizontal. Se o texto de rótulo ficar pequeno, gire o dispositivo ou abra em uma tela maior para leitura confortável.",
      },

      { type: "divider" },

      // ── Guia: Comparador MT↔MX ──────────────────────────────────
      {
        type: "heading",
        level: 4,
        text: "Comparador MT↔MX",
        subtitle: "Cenário: sua integração precisa suportar SWIFT MT e ISO 20022 (MX) em paralelo durante a migração CBPR+.",
      },
      {
        type: "paragraph",
        text:
          "O Comparador MT↔MX confronta uma mensagem SWIFT MT (formato legado) com sua correspondente ISO 20022 (MX). O objetivo é responder três perguntas: (a) esses dois XMLs representam a mesma operação? (b) quais campos foram traduzidos automaticamente e quais precisaram de heurística? (c) o que fazer com os que não têm equivalente do outro lado?",
      },
      { type: "heading", level: 3, text: "Modo A — Geração MT→MX via Builder" },
      {
        type: "paragraph",
        text:
          "No Modo A você cola apenas o MT (por exemplo, um MT103) e o ISOLeaf gera a MX correspondente automaticamente, reaproveitando o BuilderService. É o modo indicado quando você tem os MTs originais e quer ver o resultado esperado da migração para MX.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Abra **Comparador MT↔MX**.",
          "Selecione a aba **Modo A — Gerar MX a partir do MT**.",
          "Cole o **MT** no textarea (formato SWIFT clássico com blocos `{1:...}{2:...}{3:...}{4:...}`).",
          "Escolha a **família MX de destino** (pacs.008 para MT103, pacs.009 para MT202/MT202COV).",
          "Clique **Gerar & comparar**. O ISOLeaf parseia o MT, chama o Builder com o cenário CBPR+ apropriado e produz a MX; o painel de resultado mostra os dois lado a lado com o diff campo a campo.",
        ],
      },
      { type: "heading", level: 3, text: "Modo B — Comparação de duas mensagens existentes" },
      {
        type: "paragraph",
        text:
          "No Modo B você já tem o par MT e MX e quer confirmar equivalência ou apontar divergências. Este é o modo típico de conciliação: uma integração que já produz MX precisa ser validada contra os MTs históricos.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Selecione a aba **Modo B — Comparar dois payloads**.",
          "Cole o **MT** no textarea esquerdo e a **MX** no direito.",
          "Clique **Comparar**. O ISOLeaf casa os campos pela tabela de mapeamento CBPR+ e produz o diff.",
        ],
      },
      { type: "heading", level: 3, text: "Como resolver campos ambíguos" },
      {
        type: "paragraph",
        text:
          "Quando o Comparador encontra um campo com nível de confiança **Ambiguous**, ele destaca a linha em amarelo e traz uma lista de candidatos. Ambiguidade acontece porque a mesma informação pode aparecer em posições diferentes na MX conforme a variação do cenário — por exemplo, um endereço de beneficiário no MT pode virar `Cdtr/PstlAdr/AdrLine` ou `Cdtr/PstlAdr/StrtNm+PstCd+TwnNm` na MX, dependendo se o CBPR+ exige endereço estruturado (post-2025) ou aceita linhas livres (pré-2025).",
      },
      {
        type: "list",
        items: [
          "Clique na linha ambígua para expandir os candidatos.",
          "Compare o valor do MT com o de cada candidato — normalmente um deles bate exatamente com o texto que você esperaria ver.",
          "Escolha o candidato clicando no chip **Aceitar mapeamento**. O ISOLeaf grava a decisão localmente para as próximas comparações da sessão (não é persistente entre reloads — o objetivo é acelerar batches).",
          "Se nenhum candidato bater, o problema geralmente é anterior ao Comparador: o Builder pode ter escrito o campo em uma posição não esperada, ou o MT original está fora de padrão. Volte um passo (Builder ou Parser MT) para investigar.",
        ],
      },
      { type: "heading", level: 3, text: "Níveis de confiança" },
      {
        type: "table",
        headers: ["Nível", "Cor", "Significado", "Ação típica"],
        rows: [
          ["Automatic", "Verde", "Mapeamento CBPR+ direto, sem ambiguidade. O ISOLeaf casou o campo do MT com um único destino na MX com base na tabela oficial.", "Nenhuma — o diff está confiável."],
          ["Ambiguous", "Amarelo", "Existe mais de um destino candidato na MX. O ISOLeaf lista as opções e não escolhe automaticamente.", "Expandir, comparar valores e aceitar o candidato correto."],
          ["NoMapping", "Cinza", "O campo existe em um dos formatos e não tem equivalente no outro. Comum em campos ISO 20022 novos (UETR, dados estruturados de endereço, códigos de propósito ISO) e em campos MT legados (Sender's Reference, Related Reference).", "Registrar como \"perda controlada\" na migração — nem sempre há problema; nem tudo do MT precisa vir para o MX e vice-versa."],
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Regra prática: se a soma de \"Ambiguous\" + \"NoMapping\" for pequena e concentrada em campos previsíveis (endereço estruturado vs livre, sender reference), a migração está saudável. Se aparecerem campos financeiros críticos (valor, moeda, contas, BICs) em \"NoMapping\", investigue — provavelmente o parser não pegou o campo do MT por algum desvio de formatação.",
      },

      { type: "divider" },

      { type: "heading", level: 2, text: "Comunidade e suporte" },
      {
        type: "list",
        items: [
          "💬 [Discussions no GitHub](https://github.com/isoleaf-io/isoleaf/discussions) — dúvidas, ideias e feedback",
          "🐛 [Issues no GitHub](https://github.com/isoleaf-io/isoleaf/issues) — bugs e solicitações de features",
          "📧 Email: **contato@isoleaf.dev** — para parcerias e consultas enterprise",
        ],
      },
    ],
  },

  community: {
    id: "community",
    blocks: [
      {
        type: "paragraph",
        text:
          "Sua opinião é fundamental para o ISOLeaf crescer. Use os canais abaixo para reportar bugs, sugerir features ou entrar em contato.",
      },
      {
        type: "list",
        items: [
          "💬 [GitHub Discussions](https://github.com/isoleaf-io/isoleaf/discussions) — dúvidas, ideias e feedback",
          "🐛 [GitHub Issues](https://github.com/isoleaf-io/isoleaf/issues) — bugs e solicitações de features",
          "📧 [contato@isoleaf.dev](mailto:contato@isoleaf.dev) — parcerias e consultas enterprise",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Para reportar bugs com segurança, evite incluir dados sensíveis nos prints e mensagens (PAN, ARQC real, chaves). Use exemplos mascarados como nos guias.",
      },
    ],
  },

  apiDocs: {
    id: "apiDocs",
    blocks: [
      // ── Seção 1: Introdução ───────────────────────────────────────────
      { type: "heading", level: 2, text: "API REST" },
      {
        type: "paragraph",
        text:
          "O ISOLeaf expõe uma API REST cobrindo ISO 8583, criptografia EMV e todo o bloco ISO 20022 (Pix, SEPA, CBPR+, TARGET/T2, MT ↔ MX). Disponível **apenas no modo self-hosted (Docker)** — ideal para integração com ferramentas de teste automatizado, geração de massa de dados para pipelines de homologação e inspeção de traces de produção capturados.",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "Documentação interativa completa (todos os endpoints, schemas, painel \"Try it out\") está em [http://localhost:8080/api/docs](http://localhost:8080/api/docs) — powered by Scalar. Suba o Agent local antes: `docker run -p 8080:8080 ghcr.io/isoleaf-io/isoleaf:latest`.",
      },
      { type: "divider" },

      // ── Seção 2: APIs recomendadas ────────────────────────────────────
      { type: "heading", level: 2, text: "Endpoints recomendados" },
      {
        type: "paragraph",
        text:
          "Dez endpoints — cinco por protocolo — cobrem a maior parte dos cenários de integração, geração de massa de dados e automação de testes. Os demais são majoritariamente infraestrutura da própria UI. Cada bloco de código abaixo usa exatamente os mesmos valores sintéticos que o painel \"Try it out\" do Scalar traz pré-preenchidos.",
      },

      { type: "heading", level: 3, text: "ISO 8583 / EMV" },

      // 1. Parse hex
      { type: "heading", level: 4, text: "POST /api/parse/hex" },
      { type: "paragraph", text: "**Quando usar:** automatizar parse de traces de produção, validar mensagens em testes de integração, extrair campos específicos de logs ISO." },
      {
        type: "list",
        items: [
          "`hexMessage` — string · bytes da mensagem ISO 8583; auto-detecta ASCII-on-the-wire ou binary-hex",
          "`layoutName` — string · opcional, default \"default\" (field set 1987)",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/parse/hex \\
  -H "Content-Type: application/json" \\
  -d '{
    "hexMessage": "0100722000000080000016411111111111111100000000000100001000000111223344556677",
    "layoutName": "default"
  }'`,
      },
      { type: "paragraph", text: "**Retorna:** o `mti` decodificado, `messageClass`, `activeBits` e `fields[]` (cada um com `bitNumber`, `name`, `value`, `displayValue` e `length`). Parses parciais voltam como `success=false` com `parseError` estruturado — nunca 5xx." },

      // 2. Parse Bit 55
      { type: "heading", level: 4, text: "POST /api/emv/parse-bit55" },
      { type: "paragraph", text: "**Quando usar:** inspecionar dados EMV de transações chip capturadas, validar conteúdo do Bit 55 em testes de chip, debugar tags TLV." },
      {
        type: "list",
        items: [
          "`hexBit55` — string · bytes BER-TLV em hex (ex: `9F2608…9F1008…`)",
          "`headerBytes` — number · bytes de header proprietário a pular antes do TLV (default 0)",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/emv/parse-bit55 \\
  -H "Content-Type: application/json" \\
  -d '{
    "hexBit55": "9F26081122334455667788999F27018F9F10080706010A03A4B0C09F37046A5B4C3D9F3602001E9F1A0200769505000000000",
    "headerBytes": 0
  }'`,
      },
      { type: "paragraph", text: "**Retorna:** `tags[]` (cada um com `tag`, `name`, `length`, `value`) mais campos de conveniência (`arqc`, `atc`, `cryptogramType`, `authResponseCode`). Parses parciais surfacem cada tag lida até o byte de falha mais `parseError`." },

      // 3. Generate card
      { type: "heading", level: 4, text: "POST /api/cards/generate" },
      { type: "paragraph", text: "**Quando usar:** gerar massa de dados de teste para homologação, criar cartões sintéticos Luhn-válidos com Track 1/2, CVV e identidade completa." },
      {
        type: "list",
        items: [
          "`brand` — string · \"Visa\", \"Mastercard\", \"Amex\", \"Elo\", \"Hipercard\", \"DinersClub\", \"Discover\" ou \"JCB\"",
          "`cardholderName` — opcional · default é um nome brasileiro aleatório",
          "`expiry` — opcional · YYMM (ex: \"2912\"), default ~3 anos no futuro",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/cards/generate \\
  -H "Content-Type: application/json" \\
  -d '{"brand": "Visa"}'`,
      },
      { type: "paragraph", text: "**Retorna:** `pan`, `panMasked`, `cardholderName`, `expiry`, `expiryFormatted`, `serviceCode`, `cvv`, `cvv2`, `track1`, `track2`, `brand` e `generatedAt`. Apenas dados de teste — nunca alimentar com dados reais de portadores." },

      // 4. Generate ARQC
      { type: "heading", level: 4, text: "POST /api/emv/generate-arqc" },
      { type: "paragraph", text: "**Quando usar:** simular o criptograma do chip em testes de autorização EMV, validar o fluxo ARQC sem precisar de um cartão físico." },
      {
        type: "list",
        items: [
          "`pan`, `panSequenceNumber`, `atc` — identidade do cartão + contador de transação",
          "`amountAuthorized`, `amountOther`, `transactionDate`, `transactionType` — Bits 9F02 / 9F03 / 9A / 9C",
          "`terminalCountryCode`, `tvr`, `currencyCode`, `unpredictableNumber`, `aip`, `iad` — dados do terminal + transação",
          "`issuerMasterKey` — 32 chars hex · a IMK de teste publicada na suíte de integração",
          "`profile` — \"Visa\", \"Mastercard\" ou \"Elo\"",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/emv/generate-arqc \\
  -H "Content-Type: application/json" \\
  -d '{
    "issuerMasterKey": "0123456789ABCDEF0123456789ABCDEF",
    "pan": "4111111111111111",
    "panSequenceNumber": "00",
    "atc": "001E",
    "amountAuthorized": "000000001000",
    "amountOther": "000000000000",
    "terminalCountryCode": "0076",
    "tvr": "0000000000",
    "currencyCode": "0986",
    "transactionDate": "250615",
    "transactionType": "00",
    "unpredictableNumber": "AABBCCDD",
    "aip": "1800",
    "iad": "0706010A03A40000",
    "profile": "Visa"
  }'`,
      },
      { type: "paragraph", text: "**Retorna:** o `arqc` de 8 bytes (16 chars hex) mais o `sessionKey` derivado, `iccMasterKey` e `transactionData` (input do MAC) para rastreabilidade. Mesmo algoritmo da aba EMV → Generate ARQC." },

      // 5. Generate ARPC
      { type: "heading", level: 4, text: "POST /api/emv/generate-arpc" },
      { type: "paragraph", text: "**Quando usar:** simular a resposta do emissor em testes de autorização EMV, validar o cálculo de ARPC em desenvolvimento de host emissor." },
      {
        type: "list",
        items: [
          "`arqc` — o ARQC que o chip emitiu (16 chars hex)",
          "`issuerMasterKey`, `pan`, `panSequenceNumber`, `atc` — mesmo contexto de derivação do `generate-arqc`",
          "`authResponseCode` — 4 chars hex representando o RC ASCII de 2 chars (ex: \"3030\" = \"00\" aprovado)",
          "`profile` — \"Visa\", \"Mastercard\" ou \"Elo\"",
          "`method` — \"Method1\" (Visa / Elo) ou \"Method2\" (Mastercard, exige `csu`)",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/emv/generate-arpc \\
  -H "Content-Type: application/json" \\
  -d '{
    "arqc": "112233445566778899AABBCCDDEE",
    "issuerMasterKey": "0123456789ABCDEF0123456789ABCDEF",
    "pan": "4111111111111111",
    "panSequenceNumber": "00",
    "atc": "001E",
    "authResponseCode": "3030",
    "csu": null,
    "profile": "Visa",
    "method": "Method1"
  }'`,
      },
      { type: "paragraph", text: "**Retorna:** o `arpc` de 8 bytes mais o `sessionKey` usado no cálculo. O Method 2 do Mastercard também devolve o `csu` na resposta." },

      { type: "heading", level: 3, text: "ISO 20022" },

      // 6. Builder — gerar mensagem ISO 20022
      { type: "heading", level: 4, text: "POST /api/iso20022/builder/build" },
      { type: "paragraph", text: "**Quando usar:** produzir massa de dados ISO 20022 para pipelines de teste (Pix, SEPA, CBPR+, TARGET/T2), popular ambientes de homologação com mensagens estruturalmente válidas, ou baixar um esqueleto de qualquer cenário do catálogo pra editar programaticamente." },
      {
        type: "list",
        items: [
          "`messageType` — string · tipo completo com versão (ex: `pacs.008.001.13`)",
          "`scenarioId` — string · id do cenário no `ScenarioRegistry` (ex: `pix-credit-transfer`, `pix-return`, `cbpr-direct-payment`, `sepa-initiation`, `t2-credit-transfer`)",
          "`includeOptionalXPaths` — array de strings · XPaths de campos opcionais que devem aparecer no XML além dos obrigatórios (default vazio)",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/iso20022/builder/build \\
  -H "Content-Type: application/json" \\
  -d '{
    "messageType": "pacs.008.001.13",
    "scenarioId": "pix-credit-transfer",
    "includeOptionalXPaths": []
  }'`,
      },
      { type: "paragraph", text: "**Retorna:** `messageType`, `scenarioId`, `xml` (Document renderizado com os overrides do cenário aplicados) e `sections[]` (árvore de seções/campos com metadata pra guiar o editor: obrigatório, valor default, enumerações, min/max length, pattern regex). Mesmo endpoint que a UI do Builder consome." },

      // 7. Test data — person
      { type: "heading", level: 4, text: "GET /api/test-data/person" },
      { type: "paragraph", text: "**Quando usar:** popular formulários de teste com dados sintéticos coerentes (nome, CPF, e-mail, telefone-chave-Pix) em vez de digitar valores fixos, gerar cenários de carga com identidades distintas, evitar poluir logs com dados reais de portadores." },
      {
        type: "list",
        items: [
          "`locale` — query param opcional · `pt_BR` (default), `de`, `en` — direciona o gerador Faker do backend. `pt_BR` produz CPF + telefone +55; `de`/`en` produzem equivalentes locais.",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl "http://localhost:8080/api/test-data/person?locale=pt_BR"`,
      },
      { type: "paragraph", text: "**Retorna:** `name`, `cpf`, `email`, `phone` — todos válidos estruturalmente (CPF passa dígito verificador, telefone formatado E.164) e completamente sintéticos. Nunca cache — cada chamada gera uma identidade nova." },

      // 8. Validate ISO 20022 XML
      { type: "heading", level: 4, text: "POST /api/iso20022/validate" },
      { type: "paragraph", text: "**Quando usar:** validar em CI/CD que uma mensagem gerada continua conforme o XSD após uma refatoração, capturar erros de estrutura antes de enviar pra SPI/CBPR+, checar em batch um lote de mensagens capturadas." },
      {
        type: "list",
        items: [
          "`xmlContent` — string · XML completo do Document (com ou sem AppHdr)",
          "`messageType` — string opcional · quando omitido, o validador auto-detecta o tipo pelo `xmlns` do root; útil quando você quer forçar validação contra uma versão específica",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/iso20022/validate \\
  -H "Content-Type: application/json" \\
  -d '{
    "xmlContent": "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?><Document xmlns=\\"urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13\\"><FIToFICstmrCdtTrf><GrpHdr><MsgId>PIX20260710BANCO0001</MsgId><CreDtTm>2026-07-10T14:30:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf></GrpHdr></FIToFICstmrCdtTrf></Document>",
    "messageType": null
  }'`,
      },
      { type: "paragraph", text: "**Retorna:** `messageType`, `isValid` (bool), `errorCount`, `warningCount` e `errors[]` — cada erro traz `message` (texto do validador .NET), `severity` (`error`/`warning`), `lineNumber`, `linePosition` e o `xpath` do elemento ofensivo resolvido pelo `XmlLineMapper` (pra ancorar o erro na árvore parseada)." },

      // 9. SWIFT MT parse
      { type: "heading", level: 4, text: "POST /api/swift/mt/parse" },
      { type: "paragraph", text: "**Quando usar:** parsear MTs SWIFT capturadas no ambiente legado antes/durante a migração CBPR+, alimentar um pipeline de reconciliação MT vs MX, decodificar blocos de teste sintéticos em suites de integração." },
      {
        type: "list",
        items: [
          "`rawMessage` — string · MT completo com os blocos `{1:...}{2:...}{3:...}{4:...}` no formato SWIFT clássico. Aceita MT103, MT202 e MT202COV.",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/swift/mt/parse \\
  -H "Content-Type: application/json" \\
  -d '{
    "rawMessage": "{1:F01BANKBRSPAXXX0000000000}{2:I103BANKUS33XXXXN}{4:\\n:20:REF2262XYZ\\n:23B:CRED\\n:32A:260710USD1234,56\\n:50K:/12345678901\\nMARIA SILVA\\n:59:/9876543210\\nJOHN DOE\\n:71A:SHA\\n-}"
  }'`,
      },
      { type: "paragraph", text: "**Retorna:** `messageType` (`MT103`/`MT202`/`MT202COV`), `fields` (bloco 4 decodificado por tag — `:20:` senderReference, `:32A:` value date/currency/amount, `:50K:`/`:59:` ordenante/beneficiário, etc.), `senderBic`/`receiverBic` extraídos do bloco 1/2, e `warnings[]` para desvios de formato não fatais. Tipos fora de MT103/MT202/MT202COV retornam 422." },

      // 10. Pix QR Code generate
      { type: "heading", level: 4, text: "POST /api/pix/qrcode/generate" },
      { type: "paragraph", text: "**Quando usar:** gerar QR codes Pix sintéticos para testes de checkout, criar lotes de payloads Copia-e-Cola para popular telas de POS/e-commerce em homologação, produzir QRs válidos com CRC-16 correto para regressão de decoders." },
      {
        type: "list",
        items: [
          "`pixKey` — string · chave Pix (aceita EVP, e-mail, telefone, CPF ou CNPJ)",
          "`merchantName` — string · nome do recebedor (ASCII upper preferido, EMV-MPM limita a 25 chars)",
          "`merchantCity` — string · cidade (ASCII upper, ≤15 chars — endpoint auxiliar `GET /api/test-data/city` já devolve compatível)",
          "`amount` — decimal opcional · valor em reais (ex: `10` ou `12.34`); omitido gera QR sem valor pré-definido",
          "`txId` — string opcional · até 25 chars alfanuméricos; default `***` (QR estático sem TXID)",
          "`description` — string opcional · texto livre exibido no app do pagador",
          "`singleUse` — bool · `true` marca POI Method 12 (QR dinâmico de uso único); default `false` (estático)",
        ],
      },
      {
        type: "code",
        lang: "bash",
        text:
`curl -X POST http://localhost:8080/api/pix/qrcode/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "pixKey": "teste@isoleaf.dev",
    "merchantName": "ISOLEAF TESTE",
    "merchantCity": "SAO PAULO",
    "amount": 10,
    "txId": "ISOLEAF2026071000000001TX",
    "description": "Pagamento demo",
    "singleUse": false
  }'`,
      },
      { type: "paragraph", text: "**Retorna:** `payload` — a string EMV-MPM completa (Pix Copia-e-Cola) com CRC-16 calculado no final. Estrutura pronta pra virar QR code (basta jogar num renderer QR) ou pra fluir num campo de \"Copia-e-Cola\" no app do pagador." },

      { type: "divider" },

      // ── Seção 3: Documentação completa ────────────────────────────────
      { type: "heading", level: 2, text: "Documentação completa" },
      {
        type: "paragraph",
        text:
          "São 48 endpoints no total, distribuídos por 17 controllers. Os 10 documentados aqui são só a ponta didática — para a lista completa (Flow Visualizer, Comparador de Versões, upload de schemas, gestão de sessões TCP do Simulador, Health, Config, etc.) acesse a documentação interativa via Scalar:",
      },
      {
        type: "callout",
        tone: "info",
        text:
          "➜ [Abrir Scalar API Docs](http://localhost:8080/api/docs) — disponível apenas no modo self-hosted (Docker / agent local, porta 8080 por padrão). Se você mudou a porta do Agent, ajuste a URL na mão.",
      },
    ],
  },
};
