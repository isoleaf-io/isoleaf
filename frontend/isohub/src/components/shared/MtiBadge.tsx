import { Badge } from "@/components/ui/Badge";

const NAMES: Record<string, string> = {
  "0100": "Authorization Request",
  "0110": "Authorization Response",
  "0200": "Financial Request",
  "0210": "Financial Response",
  "0400": "Reversal Request",
  "0410": "Reversal Response",
  "0420": "Acquirer Reversal Advice",
  "0430": "Reversal Advice Response",
  "0800": "Network Management Request",
  "0810": "Network Management Response",
};

export function MtiBadge({ mti }: { mti: string }) {
  const isResponse = mti.length === 4 && (mti[2] === "1" || mti[2] === "3");
  return (
    <div className="flex items-center gap-2">
      <Badge tone={isResponse ? "success" : "accent"} className="font-mono text-sm px-2.5 py-1">
        {mti}
      </Badge>
      <span className="text-sm font-medium text-text-secondary">
        {NAMES[mti] ?? "Message"}
      </span>
    </div>
  );
}
