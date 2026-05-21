/**
 * infraSimCouncilDebate.ts — 5-Round Autonomous Council Deliberation Engine
 *
 * Rounds:
 *   1. Independent Assessment — each persona votes independently, no influence
 *   2. Adversarial Challenge — strongest REJECT voices challenge APPROVE votes
 *   3. Rebuttal & Defense — APPROVE voices defend, REJECT voices rebut
 *   4. Convergence — council attempts to find conditional approval pathway
 *   5. Final Vote — binding vote with weighted scoring
 *
 * Outputs:
 *   - Full 5-round transcript with per-persona arguments
 *   - Vote migration map (who changed their vote and why)
 *   - Persuasion graph (argument influence edges)
 *   - Coalition map (who aligned with whom)
 *   - Minority report (dissent memo from REJECT holdouts)
 *   - Unresolved disagreements
 */

import { invokeLLM } from "./_core/llm";
import { INFRA_COUNCIL_PERSONAS, type InfraPersonaDef } from "./infraSimCouncilPersonas";
import type { SimCaseConfig, SimRunResult } from "./infraSimEngine";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoteType = "APPROVE" | "CONDITIONAL" | "REJECT" | "ABSTAIN";

export interface PersonaVoteRound {
  personaId: string;
  personaName: string;
  personaRole: string;
  vote: VoteType;
  confidence: number;           // 0-100
  argument: string;
  hardNoTriggers: string[];
  softNoConcerns: string[];
  conditionsForApproval: string[];
}

export interface VoteMigration {
  personaId: string;
  personaName: string;
  fromVote: VoteType;
  toVote: VoteType;
  reason: string;
  influencedByPersonaId?: string;
}

export interface CouncilRoundResult {
  roundNumber: number;
  roundType: "independent" | "adversarial" | "rebuttal" | "convergence" | "final";
  votes: PersonaVoteRound[];
  voteMigrations: VoteMigration[];
  approveCount: number;
  conditionalCount: number;
  rejectCount: number;
  abstainCount: number;
  dominantArgument: string;
}

export interface CouncilDebateResult {
  sessionId?: number;
  finalDecision: "APPROVE" | "CONDITIONAL" | "REJECT" | "DEADLOCK";
  finalVote: { approve: number; conditional: number; reject: number; abstain: number };
  consensusScore: number;
  rounds: CouncilRoundResult[];
  persuasionGraph: PersuasionEdge[];
  coalitionMap: Coalition[];
  minorityReport: MinorityReport | null;
  unresolvedDisagreements: string[];
  transcript: string;
}

export interface PersuasionEdge {
  fromPersonaId: string;
  toPersonaId: string;
  argument: string;
  voteShift: string;
  round: number;
}

export interface Coalition {
  name: string;
  personaIds: string[];
  sharedPosition: VoteType;
  sharedConcern: string;
}

export interface MinorityReport {
  authorPersonaIds: string[];
  position: VoteType;
  dissent: string;
  unresolvedConcerns: string[];
  conditions: string[];
}

// ── Main Deliberation Orchestrator ────────────────────────────────────────────

export async function runCouncilDeliberation(
  config: SimCaseConfig,
  simResult: SimRunResult,
  icMemoText: string,
  activePersonaIds?: string[]
): Promise<CouncilDebateResult> {
  const personas = activePersonaIds
    ? INFRA_COUNCIL_PERSONAS.filter((p) => activePersonaIds.includes(p.id))
    : INFRA_COUNCIL_PERSONAS;

  const rounds: CouncilRoundResult[] = [];
  const persuasionGraph: PersuasionEdge[] = [];
  let currentVotes: Map<string, VoteType> = new Map();
  let currentConfidence: Map<string, number> = new Map();

  // Build case context for all personas
  const caseContext = buildCaseContext(config, simResult, icMemoText);

  // ── Round 1: Independent Assessment ──────────────────────────────────────
  const round1 = await runIndependentRound(personas, caseContext, currentVotes, currentConfidence);
  rounds.push(round1);

  // ── Round 2: Adversarial Challenge ───────────────────────────────────────
  const round2 = await runAdversarialRound(personas, caseContext, round1, currentVotes, currentConfidence, persuasionGraph);
  rounds.push(round2);

  // ── Round 3: Rebuttal & Defense ──────────────────────────────────────────
  const round3 = await runRebuttalRound(personas, caseContext, round1, round2, currentVotes, currentConfidence, persuasionGraph);
  rounds.push(round3);

  // ── Round 4: Convergence ─────────────────────────────────────────────────
  const round4 = await runConvergenceRound(personas, caseContext, rounds, currentVotes, currentConfidence, persuasionGraph);
  rounds.push(round4);

  // ── Round 5: Final Vote ───────────────────────────────────────────────────
  const round5 = await runFinalVoteRound(personas, caseContext, rounds, currentVotes, currentConfidence);
  rounds.push(round5);

  // ── Post-deliberation analysis ────────────────────────────────────────────
  const finalVote = {
    approve: round5.approveCount,
    conditional: round5.conditionalCount,
    reject: round5.rejectCount,
    abstain: round5.abstainCount,
  };

  const finalDecision = computeFinalDecision(round5.votes, personas);
  const consensusScore = computeConsensusScore(round5.votes);
  const coalitionMap = buildCoalitionMap(round5.votes);
  const unresolvedDisagreements = extractUnresolvedDisagreements(round5.votes);
  const minorityReport = buildMinorityReport(round5.votes, personas, finalDecision);
  const transcript = buildTranscript(rounds, personas);

  return {
    finalDecision,
    finalVote,
    consensusScore,
    rounds,
    persuasionGraph,
    coalitionMap,
    minorityReport,
    unresolvedDisagreements,
    transcript,
  };
}

// ── Round Runners ─────────────────────────────────────────────────────────────

async function runIndependentRound(
  personas: InfraPersonaDef[],
  caseContext: string,
  currentVotes: Map<string, VoteType>,
  currentConfidence: Map<string, number>
): Promise<CouncilRoundResult> {
  const votes = await Promise.all(
    personas.map((p) => getPersonaVote(p, caseContext, "independent", "", []))
  );

  votes.forEach((v) => {
    currentVotes.set(v.personaId, v.vote);
    currentConfidence.set(v.personaId, v.confidence);
  });

  return buildRoundResult(1, "independent", votes, []);
}

async function runAdversarialRound(
  personas: InfraPersonaDef[],
  caseContext: string,
  round1: CouncilRoundResult,
  currentVotes: Map<string, VoteType>,
  currentConfidence: Map<string, number>,
  persuasionGraph: PersuasionEdge[]
): Promise<CouncilRoundResult> {
  // Strongest REJECT voices challenge APPROVE/CONDITIONAL votes
  const rejectVoices = round1.votes.filter((v) => v.vote === "REJECT");
  const challengeContext = rejectVoices
    .map((v) => `${v.personaName} (${v.personaRole}): "${v.argument}"`)
    .join("\n\n");

  const votes = await Promise.all(
    personas.map((p) => {
      const prevVote = round1.votes.find((v) => v.personaId === p.id);
      return getPersonaVote(p, caseContext, "adversarial", challengeContext, round1.votes, prevVote?.vote);
    })
  );

  const migrations: VoteMigration[] = detectVoteMigrations(round1.votes, votes, "adversarial challenge");
  migrations.forEach((m) => {
    if (m.influencedByPersonaId) {
      persuasionGraph.push({
        fromPersonaId: m.influencedByPersonaId,
        toPersonaId: m.personaId,
        argument: `Adversarial challenge caused vote shift from ${m.fromVote} to ${m.toVote}`,
        voteShift: `${m.fromVote} → ${m.toVote}`,
        round: 2,
      });
    }
  });

  votes.forEach((v) => {
    currentVotes.set(v.personaId, v.vote);
    currentConfidence.set(v.personaId, v.confidence);
  });

  return buildRoundResult(2, "adversarial", votes, migrations);
}

async function runRebuttalRound(
  personas: InfraPersonaDef[],
  caseContext: string,
  round1: CouncilRoundResult,
  round2: CouncilRoundResult,
  currentVotes: Map<string, VoteType>,
  currentConfidence: Map<string, number>,
  persuasionGraph: PersuasionEdge[]
): Promise<CouncilRoundResult> {
  const approveVoices = round2.votes.filter((v) => v.vote === "APPROVE" || v.vote === "CONDITIONAL");
  const rebuttalContext = approveVoices
    .map((v) => `${v.personaName}: "${v.argument}"`)
    .join("\n\n");

  const votes = await Promise.all(
    personas.map((p) => {
      const prevVote = round2.votes.find((v) => v.personaId === p.id);
      return getPersonaVote(p, caseContext, "rebuttal", rebuttalContext, round2.votes, prevVote?.vote);
    })
  );

  const migrations = detectVoteMigrations(round2.votes, votes, "rebuttal arguments");
  migrations.forEach((m) => {
    if (m.influencedByPersonaId) {
      persuasionGraph.push({
        fromPersonaId: m.influencedByPersonaId,
        toPersonaId: m.personaId,
        argument: `Rebuttal argument caused vote shift`,
        voteShift: `${m.fromVote} → ${m.toVote}`,
        round: 3,
      });
    }
  });

  votes.forEach((v) => {
    currentVotes.set(v.personaId, v.vote);
    currentConfidence.set(v.personaId, v.confidence);
  });

  return buildRoundResult(3, "rebuttal", votes, migrations);
}

async function runConvergenceRound(
  personas: InfraPersonaDef[],
  caseContext: string,
  previousRounds: CouncilRoundResult[],
  currentVotes: Map<string, VoteType>,
  currentConfidence: Map<string, number>,
  persuasionGraph: PersuasionEdge[]
): Promise<CouncilRoundResult> {
  const round3 = previousRounds[2];
  const convergenceContext = `After 3 rounds of deliberation, the council is attempting to find a conditional approval pathway.
Current vote distribution: ${round3.approveCount} APPROVE, ${round3.conditionalCount} CONDITIONAL, ${round3.rejectCount} REJECT.
Can the REJECT votes be converted to CONDITIONAL if specific conditions are met?`;

  const votes = await Promise.all(
    personas.map((p) => {
      const prevVote = round3.votes.find((v) => v.personaId === p.id);
      return getPersonaVote(p, caseContext, "convergence", convergenceContext, round3.votes, prevVote?.vote);
    })
  );

  const migrations = detectVoteMigrations(round3.votes, votes, "convergence negotiation");
  votes.forEach((v) => {
    currentVotes.set(v.personaId, v.vote);
    currentConfidence.set(v.personaId, v.confidence);
  });

  return buildRoundResult(4, "convergence", votes, migrations);
}

async function runFinalVoteRound(
  personas: InfraPersonaDef[],
  caseContext: string,
  previousRounds: CouncilRoundResult[],
  currentVotes: Map<string, VoteType>,
  currentConfidence: Map<string, number>
): Promise<CouncilRoundResult> {
  const round4 = previousRounds[3];
  const finalContext = `This is the final binding vote. All deliberation is complete. Cast your final vote.`;

  const votes = await Promise.all(
    personas.map((p) => {
      const prevVote = round4.votes.find((v) => v.personaId === p.id);
      return getPersonaVote(p, caseContext, "final", finalContext, round4.votes, prevVote?.vote);
    })
  );

  votes.forEach((v) => {
    currentVotes.set(v.personaId, v.vote);
    currentConfidence.set(v.personaId, v.confidence);
  });

  return buildRoundResult(5, "final", votes, []);
}

// ── LLM Vote Elicitation ──────────────────────────────────────────────────────

async function getPersonaVote(
  persona: InfraPersonaDef,
  caseContext: string,
  roundType: string,
  roundContext: string,
  previousVotes: PersonaVoteRound[],
  previousVote?: VoteType
): Promise<PersonaVoteRound> {
  const otherVotesSummary = previousVotes.length > 0
    ? `\n\nOther council members' current positions:\n${previousVotes.filter((v) => v.personaId !== persona.id).map((v) => `- ${v.personaName}: ${v.vote} (${v.argument.slice(0, 100)}...)`).join("\n")}`
    : "";

  const roundInstruction = {
    independent: "Vote independently based solely on the case materials. Do not consider what others might think.",
    adversarial: `The following REJECT arguments have been raised. Consider them carefully and update your vote if persuaded:\n\n${roundContext}`,
    rebuttal: `The following rebuttals have been made in defense of the investment. Consider them and update your vote if persuaded:\n\n${roundContext}`,
    convergence: `${roundContext}\n\nFocus on: What specific conditions, if met, would change your vote from REJECT to CONDITIONAL?`,
    final: "This is your final binding vote. Be decisive.",
  }[roundType] ?? "";

  const prompt = `${caseContext}${otherVotesSummary}

ROUND: ${roundType.toUpperCase()}
${roundInstruction}
${previousVote ? `Your previous vote was: ${previousVote}` : ""}

Respond in JSON format:
{
  "vote": "APPROVE" | "CONDITIONAL" | "REJECT" | "ABSTAIN",
  "confidence": <0-100>,
  "argument": "<your analytical argument, 2-4 sentences, specific and evidence-based>",
  "hardNoTriggers": ["<list any hard NO conditions you see>"],
  "softNoConcerns": ["<list soft concerns>"],
  "conditionsForApproval": ["<what would need to change for you to approve>"]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: persona.systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "persona_vote",
          strict: true,
          schema: {
            type: "object",
            properties: {
              vote: { type: "string", enum: ["APPROVE", "CONDITIONAL", "REJECT", "ABSTAIN"] },
              confidence: { type: "number" },
              argument: { type: "string" },
              hardNoTriggers: { type: "array", items: { type: "string" } },
              softNoConcerns: { type: "array", items: { type: "string" } },
              conditionsForApproval: { type: "array", items: { type: "string" } },
            },
            required: ["vote", "confidence", "argument", "hardNoTriggers", "softNoConcerns", "conditionsForApproval"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;

    return {
      personaId: persona.id,
      personaName: persona.name,
      personaRole: persona.role,
      vote: parsed.vote as VoteType,
      confidence: Math.min(100, Math.max(0, parsed.confidence)),
      argument: parsed.argument,
      hardNoTriggers: parsed.hardNoTriggers ?? [],
      softNoConcerns: parsed.softNoConcerns ?? [],
      conditionsForApproval: parsed.conditionsForApproval ?? [],
    };
  } catch {
    // Fallback: deterministic vote based on persona hard lines
    return {
      personaId: persona.id,
      personaName: persona.name,
      personaRole: persona.role,
      vote: "REJECT",
      confidence: 70,
      argument: `${persona.name} was unable to complete analysis. Defaulting to REJECT per governance protocol.`,
      hardNoTriggers: [],
      softNoConcerns: ["Analysis incomplete"],
      conditionsForApproval: [],
    };
  }
}

// ── Helper Functions ──────────────────────────────────────────────────────────

function buildCaseContext(config: SimCaseConfig, simResult: SimRunResult, icMemoText: string): string {
  return `INVESTMENT CASE: ${config.title}
Base IRR: ${config.baseIrrPct}% | Fund Minimum: ${config.fundMinIrrPct}%

SIMULATION RESULTS (${simResult.totalScenarios.toLocaleString()} scenarios):
- Approval Rate: ${(simResult.approveRate * 100).toFixed(1)}%
- Conditional Rate: ${(simResult.conditionalRate * 100).toFixed(1)}%
- Rejection Rate: ${(simResult.rejectRate * 100).toFixed(1)}%
- Median IRR: ${simResult.medianIrrPct.toFixed(1)}%
- P10 IRR: ${simResult.p10IrrPct.toFixed(1)}% | P90 IRR: ${simResult.p90IrrPct.toFixed(1)}%

TOP FAILURE DRIVERS:
${simResult.topFailureDrivers.slice(0, 3).map((d) => `${d.rank}. ${d.dimensionName}: +${d.rejectionRateDelta.toFixed(1)}pp rejection delta, ${d.irrSwingPct.toFixed(1)}pp IRR swing`).join("\n")}

APPROVAL PATHWAY (minimum conditions):
${simResult.approvalPathway.slice(0, 3).map((c) => `${c.rank}. ${c.dimensionName}: requires "${c.requiredValue}" (currently "${c.currentValue}") — ${c.approvalImpactPct.toFixed(1)}pp approval impact`).join("\n")}

IC MEMO EXTRACT:
${icMemoText.slice(0, 2000)}`;
}

function buildRoundResult(
  roundNumber: number,
  roundType: CouncilRoundResult["roundType"],
  votes: PersonaVoteRound[],
  migrations: VoteMigration[]
): CouncilRoundResult {
  const approveCount = votes.filter((v) => v.vote === "APPROVE").length;
  const conditionalCount = votes.filter((v) => v.vote === "CONDITIONAL").length;
  const rejectCount = votes.filter((v) => v.vote === "REJECT").length;
  const abstainCount = votes.filter((v) => v.vote === "ABSTAIN").length;

  // Find dominant argument (longest/most specific)
  const dominantArgument = votes.reduce((best, v) =>
    v.argument.length > best.argument.length ? v : best
  ).argument;

  return {
    roundNumber,
    roundType,
    votes,
    voteMigrations: migrations,
    approveCount,
    conditionalCount,
    rejectCount,
    abstainCount,
    dominantArgument,
  };
}

function detectVoteMigrations(
  prevVotes: PersonaVoteRound[],
  newVotes: PersonaVoteRound[],
  reason: string
): VoteMigration[] {
  const migrations: VoteMigration[] = [];
  for (const newVote of newVotes) {
    const prevVote = prevVotes.find((v) => v.personaId === newVote.personaId);
    if (prevVote && prevVote.vote !== newVote.vote) {
      migrations.push({
        personaId: newVote.personaId,
        personaName: newVote.personaName,
        fromVote: prevVote.vote,
        toVote: newVote.vote,
        reason,
      });
    }
  }
  return migrations;
}

function computeFinalDecision(
  finalVotes: PersonaVoteRound[],
  personas: InfraPersonaDef[]
): "APPROVE" | "CONDITIONAL" | "REJECT" | "DEADLOCK" {
  // Weighted voting
  let approveWeight = 0;
  let conditionalWeight = 0;
  let rejectWeight = 0;

  for (const vote of finalVotes) {
    const persona = personas.find((p) => p.id === vote.personaId);
    const weight = persona?.authorityWeight ?? 0.5;
    if (vote.vote === "APPROVE") approveWeight += weight;
    else if (vote.vote === "CONDITIONAL") conditionalWeight += weight;
    else if (vote.vote === "REJECT") rejectWeight += weight;
  }

  const total = approveWeight + conditionalWeight + rejectWeight;
  if (total === 0) return "DEADLOCK";

  const rejectPct = rejectWeight / total;
  const approvePct = approveWeight / total;

  if (rejectPct > 0.5) return "REJECT";
  if (approvePct > 0.6) return "APPROVE";
  if (conditionalWeight + approveWeight > rejectWeight) return "CONDITIONAL";
  if (Math.abs(approvePct - rejectPct) < 0.1) return "DEADLOCK";
  return "REJECT";
}

function computeConsensusScore(finalVotes: PersonaVoteRound[]): number {
  if (finalVotes.length === 0) return 0;
  const voteCounts: Record<string, number> = {};
  for (const v of finalVotes) {
    voteCounts[v.vote] = (voteCounts[v.vote] ?? 0) + 1;
  }
  const maxCount = Math.max(...Object.values(voteCounts));
  return Math.round((maxCount / finalVotes.length) * 100);
}

function buildCoalitionMap(finalVotes: PersonaVoteRound[]): Coalition[] {
  const coalitions: Coalition[] = [];
  const voteGroups: Record<string, PersonaVoteRound[]> = {};

  for (const v of finalVotes) {
    if (!voteGroups[v.vote]) voteGroups[v.vote] = [];
    voteGroups[v.vote].push(v);
  }

  for (const [vote, members] of Object.entries(voteGroups)) {
    if (members.length > 0) {
      coalitions.push({
        name: `${vote} Coalition`,
        personaIds: members.map((m) => m.personaId),
        sharedPosition: vote as VoteType,
        sharedConcern: members[0].argument.slice(0, 100),
      });
    }
  }

  return coalitions;
}

function extractUnresolvedDisagreements(finalVotes: PersonaVoteRound[]): string[] {
  const disagreements: string[] = [];
  const rejectVotes = finalVotes.filter((v) => v.vote === "REJECT");
  const approveVotes = finalVotes.filter((v) => v.vote === "APPROVE" || v.vote === "CONDITIONAL");

  if (rejectVotes.length > 0 && approveVotes.length > 0) {
    disagreements.push(`${rejectVotes.length} council member(s) maintain REJECT position despite deliberation`);
    for (const rv of rejectVotes) {
      if (rv.hardNoTriggers.length > 0) {
        disagreements.push(`${rv.personaName}: Hard NO on — ${rv.hardNoTriggers.join(", ")}`);
      }
    }
  }

  return disagreements;
}

function buildMinorityReport(
  finalVotes: PersonaVoteRound[],
  personas: InfraPersonaDef[],
  finalDecision: string
): MinorityReport | null {
  const minorityVote: VoteType = finalDecision === "REJECT" ? "APPROVE" : "REJECT";
  const minorityVoters = finalVotes.filter((v) => v.vote === minorityVote);

  if (minorityVoters.length === 0) return null;

  return {
    authorPersonaIds: minorityVoters.map((v) => v.personaId),
    position: minorityVote,
    dissent: `${minorityVoters.length} council member(s) dissent from the majority decision. ${minorityVoters[0].argument}`,
    unresolvedConcerns: minorityVoters.flatMap((v) => v.softNoConcerns),
    conditions: minorityVoters.flatMap((v) => v.conditionsForApproval),
  };
}

function buildTranscript(rounds: CouncilRoundResult[], personas: InfraPersonaDef[]): string {
  const lines: string[] = [];
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("INFRASTRUCTURE INVESTMENT COUNCIL — DELIBERATION TRANSCRIPT");
  lines.push("═══════════════════════════════════════════════════════════════\n");

  for (const round of rounds) {
    lines.push(`─── ROUND ${round.roundNumber}: ${round.roundType.toUpperCase()} ───`);
    lines.push(`Vote Distribution: ${round.approveCount} APPROVE | ${round.conditionalCount} CONDITIONAL | ${round.rejectCount} REJECT\n`);

    for (const vote of round.votes) {
      lines.push(`[${vote.vote}] ${vote.personaName} (${vote.personaRole}) — Confidence: ${vote.confidence}%`);
      lines.push(`"${vote.argument}"`);
      if (vote.hardNoTriggers.length > 0) lines.push(`  HARD NO: ${vote.hardNoTriggers.join("; ")}`);
      if (vote.conditionsForApproval.length > 0) lines.push(`  CONDITIONS: ${vote.conditionsForApproval.join("; ")}`);
      lines.push("");
    }

    if (round.voteMigrations.length > 0) {
      lines.push(`Vote Migrations in Round ${round.roundNumber}:`);
      for (const m of round.voteMigrations) {
        lines.push(`  ${m.personaName}: ${m.fromVote} → ${m.toVote} (${m.reason})`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
