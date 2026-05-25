import { BookOpen, Cpu, FileText, Layers, Network, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface Topic {
  icon: typeof BookOpen;
  title: string;
  description: string;
}

const TOPICS: Topic[] = [
  {
    icon: FileText,
    title: "ISO 8583",
    description: "Estrutura de mensagens, bitmap primário/secundário, MTIs e definição dos 128 campos do padrão.",
  },
  {
    icon: Cpu,
    title: "EMV & Criptografia",
    description: "Geração e validação de ARQC/ARPC, derivação de chaves, TLV, fluxo completo issuer-side.",
  },
  {
    icon: Network,
    title: "Papéis transacionais",
    description: "Diferenças entre Adquirente, Bandeira, Emissor e Autorizador — TPDU, fields obrigatórios, echo bits.",
  },
  {
    icon: BookOpen,
    title: "Glossário",
    description: "Termos e definições: PAN, ARQC, TPDU, IAD, Service Code, ATC, CSU, e todos os acrônimos do mundo de pagamentos.",
  },
  {
    icon: Layers,
    title: "Referência de campos",
    description: "Tabela completa dos 128 bits ISO 8583 com tipo, encoding, tamanho e exemplos de uso.",
  },
  {
    icon: Sparkles,
    title: "Guias rápidos",
    description: "Receitas práticas para cada módulo: como simular adquirente, gerar PAN+ARQC, montar uma reversão, etc.",
  },
];

export default function DocsPage() {
  const { t } = useTranslation();

  return (
    <AppShell title={t("docs.title")} subtitle={t("docs.subtitle")}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOPICS.map((topic) => {
          const Icon = topic.icon;
          return (
            <Card key={topic.title} className="hover:border-accent/40 transition-colors">
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-9 h-9 rounded-md bg-accent-bg text-accent-text flex items-center justify-center shrink-0">
                    <Icon size={18} />
                  </div>
                  <Badge tone="warning" className="shrink-0">
                    {t("docs.comingSoon")}
                  </Badge>
                </div>
                <h3 className="text-sm font-semibold leading-tight">{topic.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {topic.description}
                </p>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
