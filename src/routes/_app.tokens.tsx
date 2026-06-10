import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Server, Zap, BrainCircuit, RefreshCw } from "lucide-react";
import { useState } from "react";

// Fetch today's usage from Supabase directly
const apiUsageQ = queryOptions({
  queryKey: ["api_usage"],
  queryFn: async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("api_usage")
      .select("*")
      .eq("date", today);
    if (error) throw error;
    return data;
  },
  refetchInterval: 10000, // Refresh every 10s to see live updates
});

export const Route = createFileRoute("/_app/tokens")({
  head: () => ({ meta: [{ title: "Consumo de Tokens · SlideForge" }] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(apiUsageQ);
  },
  component: TokensMeter,
});

const AI_PROVIDERS = [
  {
    id: "groq_70b",
    name: "Groq Llama 3.3 70B",
    description: "Cerebro principal ultrarrápido (Límite diario estricto)",
    icon: Zap,
    color: "bg-orange-500",
    gradient: "from-orange-500/20 to-orange-500/5",
  },
  {
    id: "groq_8b",
    name: "Groq Llama 3.1 8B",
    description: "Emergencia / Fallback (Límite amplio)",
    icon: Activity,
    color: "bg-amber-500",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Generación de Imágenes e IA secundaria",
    icon: SparklesIcon,
    color: "bg-blue-500",
    gradient: "from-blue-500/20 to-blue-500/5",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Análisis estructural (Basado en saldo, sin límite diario)",
    icon: BrainCircuit,
    color: "bg-indigo-500",
    gradient: "from-indigo-500/20 to-indigo-500/5",
  },
];

function SparklesIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

function TokensMeter() {
  const { data } = useSuspenseQuery(apiUsageQ);
  const qc = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    setIsRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["api_usage"] });
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Uso de Tokens (Hoy)</h1>
          <p className="text-muted-foreground mt-2">
            Monitoriza el consumo global de las Inteligencias Artificiales. Las barras muestran el progreso hasta el límite gratuito.
          </p>
        </div>
        <button
          onClick={refresh}
          className="p-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          title="Actualizar datos"
        >
          <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </header>

      <div className="grid gap-6">
        {AI_PROVIDERS.map((provider) => {
          const usage = data.find((row) => row.provider === provider.id);
          const used = usage?.tokens_used || 0;
          const limit = usage?.limit_tokens || (provider.id === "deepseek" ? 5000000 : 100000);
          
          let percentage = (used / limit) * 100;
          if (percentage > 100) percentage = 100;

          const isCritical = percentage >= 90;
          const isWarning = percentage >= 75 && percentage < 90;

          const Icon = provider.icon;

          return (
            <div
              key={provider.id}
              className={`rounded-xl border border-border p-6 relative overflow-hidden bg-gradient-to-r ${provider.gradient}`}
            >
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${provider.color} text-white shadow-lg`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{provider.name}</h2>
                    <p className="text-sm text-muted-foreground">{provider.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono">
                    {used.toLocaleString()} <span className="text-sm text-muted-foreground font-sans font-normal">/ {limit.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Tokens consumidos</p>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="h-4 w-full bg-secondary rounded-full overflow-hidden relative z-10 border border-border/50 shadow-inner">
                {/* Animated Progress Fill */}
                <div
                  className={`h-full transition-all duration-1000 ease-out ${
                    isCritical ? "bg-red-500" : isWarning ? "bg-yellow-500" : provider.color
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <div className="mt-2 flex justify-between text-xs text-muted-foreground relative z-10">
                <span>0%</span>
                <span>{percentage.toFixed(1)}% Usado</span>
                <span>100%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
