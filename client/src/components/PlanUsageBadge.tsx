/**
 * PlanUsageBadge — shows plan tier + run usage in the navbar
 * Renders as a compact pill: "Trial · 42/50" or "Pro · 312/500"
 */

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

export function PlanUsageBadge() {
  const { user } = useAuth();
  const { data } = trpc.billing.getUsageStatus.useQuery(undefined, {
    enabled: !!user,
    staleTime: 60_000, // refresh every 60s
    refetchInterval: 60_000,
  });

  if (!user || !data) return null;

  const { planTier, trialRunsRemaining, daysUntilTrialExpiry, monthlyRunsLimit, monthlyRunsUsed, isExpired, shouldRedirectToConversion } = data;

  // Colour coding
  let pillClass = "bg-cyan-900/40 border-cyan-700/50 text-cyan-300";
  let label = "";
  let usage = "";

  if (planTier === "trial") {
    if (isExpired || trialRunsRemaining <= 0) {
      pillClass = "bg-red-900/40 border-red-700/50 text-red-300";
      label = "Trial Ended";
      usage = "";
    } else if (trialRunsRemaining <= 10) {
      pillClass = "bg-amber-900/40 border-amber-700/50 text-amber-300";
      label = "Free";
      usage = daysUntilTrialExpiry != null
        ? `${trialRunsRemaining} runs · ${daysUntilTrialExpiry} days left`
        : `${trialRunsRemaining} runs left`;
    } else {
      label = "Free";
      usage = daysUntilTrialExpiry != null
        ? `${trialRunsRemaining} runs · ${daysUntilTrialExpiry} days left`
        : `${trialRunsRemaining} runs left`;
    }
  } else if (planTier === "standard") {
    pillClass = "bg-blue-900/40 border-blue-700/50 text-blue-300";
    label = "Standard";
    usage = monthlyRunsLimit ? `${monthlyRunsUsed}/${monthlyRunsLimit}` : `${monthlyRunsUsed} runs`;
  } else if (planTier === "pro") {
    pillClass = "bg-purple-900/40 border-purple-700/50 text-purple-300";
    label = "Pro";
    usage = monthlyRunsLimit ? `${monthlyRunsUsed}/${monthlyRunsLimit}` : `${monthlyRunsUsed} runs`;
  } else if (planTier === "enterprise") {
    pillClass = "bg-amber-900/40 border-amber-700/50 text-amber-300";
    label = "Enterprise";
    usage = "Unlimited";
  }

  return (
    <Link href="/upgrade">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 ${pillClass}`}
        title={daysUntilTrialExpiry != null ? `Trial expires in ${daysUntilTrialExpiry} days` : undefined}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isExpired ? "bg-red-400" : planTier === "enterprise" ? "bg-amber-400" : "bg-current"
          }`}
        />
        {label}{usage ? ` · ${usage}` : ""}
      </span>
    </Link>
  );
}
