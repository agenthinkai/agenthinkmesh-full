import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Scale, Eye, Heart, TrendingUp, AlertTriangle, Clock, Shield, Users,
  Compass, Sparkles, ArrowRight, RotateCcw, Share2, Loader2,
  CheckCircle2, XCircle, MinusCircle, MessageSquare, Check,
  Mic, MicOff, Globe, Phone, Mail,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

// ============================================================
// TYPES
// ============================================================

type VoteEnum = 'HARD_YES' | 'SOFT_YES' | 'THINK' | 'SOFT_NO' | 'HARD_NO';
type VerdictLevel = 'HARD_YES' | 'SOFT_YES' | 'THINK' | 'SOFT_NO' | 'HARD_NO';
type DeliberationPhase = 'input' | 'deliberating' | 'verdict' | 'heavy' | 'language';
type AgentColor = 'cyan' | 'amber' | 'slate' | 'emerald' | 'rose' | 'pink' | 'indigo' | 'teal' | 'violet' | 'orange';

interface CouncilMember {
  id: string;
  name: string;
  icon: React.ElementType;
  role: string;
  color: AgentColor;
}

interface ResponseEntry {
  vote: VoteEnum;
  say: string;
}

interface CouncilResult {
  agent: CouncilMember;
  vote: VoteEnum;
  say: string;
}

interface VerdictConfig {
  label: string;
  tone: string;
  text: string;
  border: string;
  glow: string;
}

interface SharePayload {
  question: string;
  verdict: VerdictLevel;
  judgeText: string;
}

// ============================================================
// THE COUNCIL — 10 named agents
// ============================================================

const COUNCIL: CouncilMember[] = [
  { id: 'analyst',   name: 'The Analyst',      icon: TrendingUp,    role: 'looks at numbers, costs, and tradeoffs',            color: 'cyan'    },
  { id: 'skeptic',   name: 'The Skeptic',      icon: AlertTriangle, role: 'stress-tests every assumption you made',            color: 'amber'   },
  { id: 'historian', name: 'The Historian',    icon: Clock,         role: 'remembers what happened the last time',             color: 'slate'   },
  { id: 'optimist',  name: 'The Optimist',     icon: Sparkles,      role: 'argues for the upside you might be undervaluing',   color: 'emerald' },
  { id: 'devils',    name: "Devil's Advocate", icon: Eye,           role: 'surfaces what you do not want to hear',             color: 'rose'    },
  { id: 'heart',     name: 'The Heart',        icon: Heart,         role: 'asks what you actually want, not what you should',  color: 'pink'    },
  { id: 'compass',   name: 'The Compass',      icon: Compass,       role: 'checks alignment with your values and direction',   color: 'indigo'  },
  { id: 'guardian',  name: 'The Guardian',     icon: Shield,        role: 'watches for risks to health, family, security',     color: 'teal'    },
  { id: 'witness',   name: 'The Witness',      icon: Users,         role: 'speaks for the people this decision affects',       color: 'violet'  },
  { id: 'judge',     name: 'The Judge',        icon: Scale,         role: 'weighs the council and renders the verdict',        color: 'orange'  },
];

const VERDICTS: Record<VerdictLevel, VerdictConfig> = {
  HARD_YES: { label: 'GO',         tone: 'bg-emerald-500', text: 'text-emerald-50', border: 'border-emerald-400', glow: 'shadow-emerald-500/30' },
  SOFT_YES: { label: 'LEAN YES',   tone: 'bg-teal-500',    text: 'text-teal-50',    border: 'border-teal-400',    glow: 'shadow-teal-500/30'    },
  THINK:    { label: 'THINK MORE', tone: 'bg-amber-500',   text: 'text-amber-50',   border: 'border-amber-400',   glow: 'shadow-amber-500/30'   },
  SOFT_NO:  { label: 'LEAN NO',    tone: 'bg-orange-500',  text: 'text-orange-50',  border: 'border-orange-400',  glow: 'shadow-orange-500/30'  },
  HARD_NO:  { label: 'STOP',       tone: 'bg-rose-500',    text: 'text-rose-50',    border: 'border-rose-400',    glow: 'shadow-rose-500/30'    },
};

// ============================================================
// RESPONSE BANK — 15 lines per non-judge agent
// ============================================================

const RESPONSE_BANK: Record<string, ResponseEntry[]> = {
  analyst: [
    { vote: 'SOFT_YES', say: 'The numbers favor moving, but only if you can absorb a 20% downside without it breaking you.' },
    { vote: 'THINK',    say: 'The cost side is clear. The benefit side is mostly story. Quantify one assumption first.' },
    { vote: 'HARD_YES', say: 'Expected value is strongly positive even under pessimistic assumptions. The math is on your side.' },
    { vote: 'SOFT_NO',  say: 'The price you would pay exceeds the value you would receive in any realistic scenario.' },
    { vote: 'THINK',    say: 'You are anchoring on a number that is not actually anchored to anything. Recalculate.' },
    { vote: 'SOFT_YES', say: 'The upside is modest, the downside is limited, and the time investment is small. Quietly worth it.' },
    { vote: 'HARD_NO',  say: 'You are confusing gross with net. Once you account for what this costs you elsewhere, the case collapses.' },
    { vote: 'THINK',    say: 'You have not priced your time. Do that and ask again — the answer will be clearer than you expect.' },
    { vote: 'SOFT_NO',  say: 'The base rate for things like this working out is lower than your gut suggests. Adjust accordingly.' },
    { vote: 'HARD_YES', say: 'The opportunity cost of doing nothing is larger than the opportunity cost of doing this. Move.' },
    { vote: 'SOFT_YES', say: 'The downside is bounded. The upside is open-ended. That is the shape of a bet worth taking.' },
    { vote: 'THINK',    say: 'You are reasoning forward from desire instead of backward from constraints. Reverse the order.' },
    { vote: 'SOFT_NO',  say: 'The numbers look fine in isolation. The numbers look worse when you compare them to the alternatives.' },
    { vote: 'HARD_YES', say: 'Stop optimizing. The decision is positive-expected-value even if you execute it poorly. Begin.' },
    { vote: 'THINK',    say: 'There is a missing line in your cost analysis and you know which one it is. Add it before deciding.' },
  ],
  skeptic: [
    { vote: 'SOFT_NO',  say: 'Three assumptions in your framing are doing all the work. If any one fails, the whole thing collapses.' },
    { vote: 'THINK',    say: 'You are imagining the version where it works. The version where it does not work is more probable than you think.' },
    { vote: 'HARD_NO',  say: 'You have heard this idea before and rejected it. What changed is your mood, not the facts.' },
    { vote: 'SOFT_YES', say: 'I cannot find the fatal flaw, which is itself suspicious. Proceed but document your assumptions.' },
    { vote: 'SOFT_NO',  say: 'The success case requires four things to go right in sequence. That is a 30% scenario, not a base case.' },
    { vote: 'HARD_NO',  say: 'Every story you tell about why this works depends on someone else doing what they have never done before.' },
    { vote: 'THINK',    say: 'You have not yet stated what would make you abandon this. Until you can, you are not deciding — you are committing.' },
    { vote: 'SOFT_NO',  say: 'The plan is reasonable. The plan B is missing. That asymmetry should worry you.' },
    { vote: 'THINK',    say: 'Test this idea against the person you trust most who would disagree. If you have not, you are not ready.' },
    { vote: 'HARD_NO',  say: 'The case for this got stronger every time you told it. That is rehearsal, not analysis.' },
    { vote: 'SOFT_YES', say: 'The risks are real and you have named them. That alone puts you ahead of most people who try this.' },
    { vote: 'SOFT_NO',  say: 'You are treating the optimistic case as the baseline. Reframe the baseline as the median outcome.' },
    { vote: 'THINK',    say: 'What would have to be true for you to be wrong here? Answer that first, then answer the original question.' },
    { vote: 'HARD_NO',  say: 'The version of this you are evaluating is not the version that will actually happen. They never are.' },
    { vote: 'SOFT_NO',  say: 'Your conviction has grown faster than your evidence. Slow down until they match again.' },
  ],
  historian: [
    { vote: 'SOFT_NO',  say: 'The last three times you considered something like this, you regretted the version that moved fast.' },
    { vote: 'THINK',    say: 'You have been here before. The pattern matters. What is genuinely different now?' },
    { vote: 'SOFT_YES', say: 'Past attempts failed for reasons that no longer apply. The conditions are better this time.' },
    { vote: 'HARD_YES', say: 'Every previous attempt was killed by an obstacle that is no longer present. Move.' },
    { vote: 'SOFT_NO',  say: 'You are about to repeat a decision you previously called your worst. Notice the pattern.' },
    { vote: 'THINK',    say: 'A version of this decision shows up in your life every few years. What does the shape tell you?' },
    { vote: 'HARD_NO',  say: 'You are running the same script that produced the last bad outcome. The script is the problem, not the timing.' },
    { vote: 'SOFT_YES', say: 'You have done harder things than this and you have done them well. Trust the record.' },
    { vote: 'THINK',    say: 'The last time you said yes too quickly to something like this, you spent two years undoing it. Move slower.' },
    { vote: 'HARD_YES', say: 'You have a track record of regretting the cautious version, not the bold one. Honor that.' },
    { vote: 'SOFT_NO',  say: 'Your past self would warn you about this one specifically. You know which warning.' },
    { vote: 'SOFT_YES', say: 'You have the scars from the last attempt. Scars are an advantage, not a disqualification.' },
    { vote: 'THINK',    say: 'Ask the person who knew you ten years ago what they would say. Their answer matters here.' },
    { vote: 'HARD_NO',  say: 'You have made this exact mistake under different names three times. The name has changed; the mistake has not.' },
    { vote: 'SOFT_YES', say: 'What you learned the last time is exactly the lesson this decision asks you to apply.' },
  ],
  optimist: [
    { vote: 'HARD_YES', say: 'The downside is recoverable. The upside is not repeatable. Asymmetric bets like this are why people change their lives.' },
    { vote: 'SOFT_YES', say: 'You are underweighting the version where this goes better than expected. That version is real.' },
    { vote: 'HARD_YES', say: 'Five years from now you will not remember the discomfort of doing this. You will only remember whether you did.' },
    { vote: 'SOFT_YES', say: 'The cost of saying no is invisible but real. You only see the cost of saying yes.' },
    { vote: 'THINK',    say: 'I want to vote yes but I cannot find the version of this that compounds. Show me the second-order win.' },
    { vote: 'HARD_YES', say: 'The doors that open if this works are doors you cannot see from where you are standing now.' },
    { vote: 'SOFT_YES', say: 'You do not need this to succeed completely. You need it to succeed enough to take you to the next thing.' },
    { vote: 'HARD_YES', say: 'The conditions for this are better than they will be next year. The window narrows from here.' },
    { vote: 'SOFT_YES', say: 'A small win here is still a win. You do not need a big one to justify the move.' },
    { vote: 'THINK',    say: 'The upside is there but you have not let yourself see it yet. Imagine it for sixty seconds and ask again.' },
    { vote: 'HARD_YES', say: 'You have permission to want this. The wanting is data, not weakness.' },
    { vote: 'SOFT_YES', say: 'The people you most admire would say yes to this in your position. Borrow their nerve.' },
    { vote: 'HARD_YES', say: 'Regret about not trying compounds. Regret about trying and failing fades. The math favors trying.' },
    { vote: 'SOFT_YES', say: 'The pessimistic case is not as bad as you are picturing. You have survived worse.' },
    { vote: 'THINK',    say: 'You are not asking whether to do this. You are asking whether you deserve to. Different question.' },
  ],
  devils: [
    { vote: 'HARD_NO',  say: 'The reason you are asking the council is that you already know the answer and you are looking for permission.' },
    { vote: 'SOFT_NO',  say: 'Strip out the rationalization and what remains is a decision driven by ego, fear, or fatigue. Which one?' },
    { vote: 'THINK',    say: 'You have framed this to maximize agreement. Reframe it from the perspective of the person it harms.' },
    { vote: 'SOFT_NO',  say: 'You are solving a symptom. The real problem is upstream and this decision does not touch it.' },
    { vote: 'HARD_NO',  say: 'A version of you in six months will read this question and wonder why you took it seriously.' },
    { vote: 'SOFT_NO',  say: 'You are calling this brave. From the outside it looks like running.' },
    { vote: 'HARD_NO',  say: 'You want to be the person who did this more than you want the thing itself. That is identity shopping.' },
    { vote: 'THINK',    say: 'Who benefits if you say yes? List them honestly. If your name is not in the top three, reconsider.' },
    { vote: 'SOFT_NO',  say: 'The reasoning is sound and the conclusion is wrong. That happens when the premise is the lie.' },
    { vote: 'HARD_NO',  say: 'You are doing this to prove something to someone who is not paying attention. They will not notice. You will pay.' },
    { vote: 'THINK',    say: 'If you could not tell anyone you did this, would you still want to? The answer locates the real motive.' },
    { vote: 'SOFT_NO',  say: 'You are dressing up an impulse as a strategy. Both can be valid. Be honest about which it is.' },
    { vote: 'HARD_NO',  say: 'The story you will tell about this decision matters more to you than the decision itself. Bad sign.' },
    { vote: 'THINK',    say: 'You have not yet named what you are afraid of. Until you do, the decision is not actually about what you say it is.' },
    { vote: 'SOFT_NO',  say: 'Everyone you have asked for advice agrees with you. That is not consensus, that is curation.' },
  ],
  heart: [
    { vote: 'HARD_YES', say: 'Setting aside what is reasonable — do you want this? The answer is yes and you know it.' },
    { vote: 'SOFT_YES', say: 'It will not feel exciting. It will feel correct. That is the better signal.' },
    { vote: 'THINK',    say: 'You are asking permission from logic for something logic cannot decide. The answer is in a different place.' },
    { vote: 'SOFT_NO',  say: 'You want the result, not the process. The process is most of the cost.' },
    { vote: 'HARD_NO',  say: 'You are doing this for someone else and dressing it up as your own choice. Stop.' },
    { vote: 'HARD_YES', say: 'There is a version of your life where you did this, and you can feel it from here. Go meet that version.' },
    { vote: 'SOFT_YES', say: 'The part of you that wants this is older than the part of you that is afraid. Trust the older one.' },
    { vote: 'THINK',    say: 'You are not undecided. You are negotiating with yourself. Stop negotiating and listen.' },
    { vote: 'HARD_YES', say: 'You have been moving toward this answer for longer than you have admitted. Honor the direction.' },
    { vote: 'SOFT_NO',  say: 'You are tired, not wrong. The decision will be clearer after rest. Do not decide from depletion.' },
    { vote: 'HARD_NO',  say: 'You are looking for a way to want this. That is not the same as wanting it.' },
    { vote: 'SOFT_YES', say: 'The discomfort you feel about saying yes is not a warning. It is the size of the thing you are choosing.' },
    { vote: 'THINK',    say: 'Sit with the question one more day. Not to delay — to let the real answer surface. It will.' },
    { vote: 'HARD_YES', say: 'You do not need a reason. You have wanted this for a long time. That is reason enough.' },
    { vote: 'SOFT_NO',  say: 'You love the idea of this more than you love what it would actually be. Notice the gap.' },
  ],
  compass: [
    { vote: 'SOFT_YES', say: 'This moves you in the direction you have said you want to go. The alignment is real, even if imperfect.' },
    { vote: 'THINK',    say: 'It is not against your values. It is also not particularly for them. Neutral on the dimension that matters most.' },
    { vote: 'HARD_NO',  say: 'This contradicts something you said was non-negotiable six months ago. Either that was wrong or this is.' },
    { vote: 'SOFT_NO',  say: 'You are drifting. Not on this decision specifically, but the cumulative drift is in a direction worth noticing.' },
    { vote: 'HARD_YES', say: 'Every value you hold points the same way on this one. Rare. Honor it.' },
    { vote: 'SOFT_YES', say: 'The decision is consistent with who you have been trying to become. That consistency is worth weight.' },
    { vote: 'HARD_NO',  say: 'You would not advise the person you love most to make this choice. Apply your own standard.' },
    { vote: 'THINK',    say: 'Your stated values and your revealed values are pointing different directions on this. Reconcile them first.' },
    { vote: 'SOFT_YES', say: 'The decision is small enough not to matter and large enough to set direction. Pay attention to the direction.' },
    { vote: 'HARD_YES', say: 'This is the kind of decision your future self will use as evidence of who you actually were. Choose accordingly.' },
    { vote: 'SOFT_NO',  say: 'It moves you sideways, not forward. Sideways at this stage of life is its own kind of cost.' },
    { vote: 'THINK',    say: 'Name the value this decision serves in one word. If you cannot, the decision is not about a value — it is about a feeling.' },
    { vote: 'HARD_NO',  say: 'You are about to make a decision that contradicts the story you want your life to tell. The contradiction is the answer.' },
    { vote: 'SOFT_YES', say: 'It is not the choice you would have made ten years ago. That is the point. You are not who you were.' },
    { vote: 'THINK',    say: 'What you call your values are sometimes your fears with better branding. Which one is operating here?' },
  ],
  guardian: [
    { vote: 'SOFT_NO',  say: 'The downside scenario hurts people you have not consulted. Talk to them before deciding.' },
    { vote: 'THINK',    say: 'Health, family, and security each take a small hit. Together that is meaningful. Plan for the recovery, not just the move.' },
    { vote: 'SOFT_YES', say: 'The risks are real but bounded. You have margin to absorb the bad version.' },
    { vote: 'HARD_NO',  say: 'You are betting something you cannot afford to lose against something you do not need.' },
    { vote: 'HARD_YES', say: 'The risk of not doing this is larger than the risk of doing it. Inaction is the dangerous option here.' },
    { vote: 'SOFT_NO',  say: 'Your body has been telling you something about this and you have been ignoring it. Listen first, decide second.' },
    { vote: 'HARD_NO',  say: 'There is no version of this where the people closest to you are not paying a cost. Account for that cost honestly.' },
    { vote: 'SOFT_YES', say: 'You have built enough margin in your life to take this risk. That margin exists to be used, not preserved forever.' },
    { vote: 'THINK',    say: 'Sleep is the missing variable. Decide this after a week of real rest, not from inside the fatigue.' },
    { vote: 'HARD_YES', say: 'Stability that costs you your aliveness is not stability. It is decay with a better name.' },
    { vote: 'SOFT_NO',  say: 'You are protected against the obvious risks. The non-obvious ones are where this gets you.' },
    { vote: 'THINK',    say: 'One conversation with a doctor, a lawyer, or a friend who has done this would change the picture. Have it first.' },
    { vote: 'SOFT_YES', say: 'The boring path also has risks. They are just slower and harder to see. Do not assume safety where there is only inertia.' },
    { vote: 'HARD_NO',  say: 'You are healthy, loved, and secure. This decision threatens at least one of those without compensating the others.' },
    { vote: 'SOFT_YES', say: 'The worst case scenario is something you have survived a version of already. You know the shape of the recovery.' },
  ],
  witness: [
    { vote: 'THINK',    say: 'Three people in your life have not been consulted on this and one of them will bear the cost. Fix that first.' },
    { vote: 'SOFT_NO',  say: 'You are framing this as a personal decision. The people around you would call it a joint decision.' },
    { vote: 'SOFT_YES', say: 'The people who matter would respect this choice, even the ones it inconveniences.' },
    { vote: 'HARD_YES', say: 'Everyone who loves you wants you to choose yourself here. You are the only one not granting permission.' },
    { vote: 'HARD_NO',  say: 'This decision asks others to sacrifice something for an outcome only you benefit from. Reconsider the trade.' },
    { vote: 'THINK',    say: 'Picture the conversation where you tell the person most affected. Notice what you flinch from. That is the decision.' },
    { vote: 'SOFT_YES', say: 'The people who depend on you will adjust. They have done it before. You underestimate their resilience.' },
    { vote: 'HARD_NO',  say: 'You are about to ask someone to forgive you for something. Have that conversation before, not after.' },
    { vote: 'SOFT_NO',  say: 'The collateral effects of this decision are not small. They land on someone you love.' },
    { vote: 'HARD_YES', say: 'The people who would oppose this are protecting their own comfort, not yours. Notice the difference.' },
    { vote: 'THINK',    say: 'Imagine telling your younger self about this decision. What do they ask? Answer that.' },
    { vote: 'SOFT_YES', say: 'Your absence in one role makes you more present in another. The trade is real but not lopsided.' },
    { vote: 'HARD_NO',  say: 'You are doing this without consent from the people whose consent matters. That is a problem, not a detail.' },
    { vote: 'THINK',    say: 'Who in your life would be quietly relieved if you did this? Who would be quietly hurt? Both matter.' },
    { vote: 'SOFT_NO',  say: 'You are alone in this room because you have not invited the right people into it. That is solvable before deciding.' },
  ],
};

// ============================================================
// JUDGE — tier-conditional, picks lines that match the actual outcome
// ============================================================

const JUDGE_BANK: Record<VerdictLevel, string[]> = {
  HARD_YES: [
    'The council is rare in its agreement. The signal is unmistakable. Move.',
    'Across nine voices the answer pointed the same direction. When the council aligns this completely, the decision is not what to do — it is when to begin.',
    'The Optimist, the Heart, and the Compass each found their own reason to vote yes. Three independent paths to the same answer is not a coincidence.',
    'Even the Skeptic could not build a serious case against. Note that and proceed.',
    'The strongest dissent in this council was procedural, not directional. Move, and adjust the timing if you must.',
  ],
  SOFT_YES: [
    'The council leans toward yes but not without dissent. Move, but slower than you planned, and address what the dissenters named.',
    'The case for moving is stronger than the case against, but the case against is not trivial. Honor both — proceed, but with the conditions the council named.',
    'Yes, with reservations. The reservations matter. Read what the Skeptic and the Guardian said again before you begin.',
    'The vote is yes but the council is not unified. That is fine — the disagreement is the map of what you need to plan for.',
    'A working majority of the council supports this. Treat that as permission, not confirmation. The execution still has to earn the verdict.',
  ],
  THINK: [
    'The council has not reached confidence on either side. Sleep on it, gather one more input, return when something has actually changed.',
    'You are not ready to decide. The council is telling you so. That is not a failure — it is the correct signal.',
    'The disagreement among the council is the same disagreement happening inside you. Resolve it there before you ask here again.',
    'No clear direction. Wait. The council is not wrong to be uncertain — the question itself is not yet ripe.',
  ],
  SOFT_NO: [
    'The council leans toward no, but not severely. The objections are real and you have not addressed them. Reconsider, or come back with a better answer to what was raised.',
    'More of the council voted against than for, and the strongest voices were among them. That is signal, not noise.',
    'The case against is structural, not stylistic. The Skeptic and the Witness in particular named things that have to be fixed before this becomes a yes.',
    'A soft no. Not because the idea is bad, but because the version in front of the council is not the right version of it.',
    'The council is asking you to refine the question before answering it. Take that seriously.',
  ],
  HARD_NO: [
    'The dissent across this council is severe and well-grounded. The council recommends against.',
    "When the Skeptic, the Historian, and the Devil's Advocate align this strongly, the signal is structural. Do not move on this version.",
    'Multiple independent objections from voices that usually disagree. That convergence is rare. Honor it.',
    'The council finds the case unworkable as stated. The right response is not to push through — it is to ask a different question.',
    'A clear no. The reasons named by the council are not obstacles to manage; they are the answer.',
  ],
};

// ============================================================
// LANGUAGE DETECTION — Unicode script ranges, no external library
// Detects Arabic, CJK (Mandarin), Devanagari (Hindi), Tamil
// Returns { lang: string; confidence: number }
// ============================================================

export interface LangResult {
  lang: 'arabic' | 'cjk' | 'devanagari' | 'tamil' | 'english';
  confidence: number;
}

export function detectLanguage(text: string): LangResult {
  if (!text || text.trim().length < 3) return { lang: 'english', confidence: 0 };
  const chars = Array.from(text.trim());
  const total = chars.length;
  let arabic = 0, cjk = 0, devanagari = 0, tamil = 0;
  for (const ch of chars) {
    const cp = ch.codePointAt(0) ?? 0;
    if ((cp >= 0x0600 && cp <= 0x06FF) || (cp >= 0x0750 && cp <= 0x077F) || (cp >= 0xFB50 && cp <= 0xFDFF) || (cp >= 0xFE70 && cp <= 0xFEFF)) arabic++;
    else if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0x20000 && cp <= 0x2A6DF) || (cp >= 0x3040 && cp <= 0x30FF)) cjk++;
    else if (cp >= 0x0900 && cp <= 0x097F) devanagari++;
    else if (cp >= 0x0B80 && cp <= 0x0BFF) tamil++;
  }
  const counts: [LangResult['lang'], number][] = [
    ['arabic', arabic], ['cjk', cjk], ['devanagari', devanagari], ['tamil', tamil],
  ];
  const [topLang, topCount] = counts.reduce((a, b) => b[1] > a[1] ? b : a);
  const confidence = topCount / total;
  if (confidence >= 0.80) return { lang: topLang, confidence };
  return { lang: 'english', confidence: 0 };
}

// ============================================================
// SENSITIVE CATEGORY DETECTION
// ============================================================

const HEAVY_PATTERNS: RegExp[] = [
  // Divorce / ending marriage
  /\bdivorc/i, /\bending my marriage\b/i, /\bleave my (husband|wife|spouse|partner)\b/i,
  /\bseparate from my (husband|wife|spouse)\b/i, /\bsplit from my (husband|wife|spouse)\b/i,
  // Custody / children
  /\bcustody\b/i, /\btake (my |the )?child(ren)?\b/i, /\babandon(ing)? (my |the )?child(ren)?\b/i,
  /\bminor.{0,10}welfare\b/i,
  // Self-harm / suicide
  /\bkill myself\b/i, /\bsuicid/i, /\bend my life\b/i, /\bwant to die\b/i,
  /\bshould i die\b/i, /\bhurt(ing)? myself\b/i, /\bself.harm\b/i, /\bself harm\b/i,
  /\btake my (own )?life\b/i, /\bno reason to live\b/i,
  // Abuse
  /\babuse/i, /\bhits me\b/i, /\bhurts me\b/i, /\bbeats me\b/i,
  /\bphysically (hurt|harm|abuse)/i, /\bsexually (abuse|assault)/i,
  // Terminal / end-of-life
  /\bterminal(ly)?\b/i, /\bend.of.life\b/i, /\bpalliative\b/i,
  /\bdying (of|from)\b/i, /\blife.limiting\b/i,
  // Financial crisis
  /\bbankrupt/i, /\bforeclosur/i, /\bdebt collapse\b/i, /\bcan.t pay (my )?debt/i,
  /\blosing (my |the )?house\b/i, /\bfinancial ruin\b/i,
  // Crime / criminal
  /\breport(ing)? (a |the )?crime\b/i,  /\bcriminal (charge|charges|allegation|case)\b/i,  /\bpress charges\b/i, /\bgo to (the )?police\b/i,
];

export function isHeavyCategory(question: string): boolean {
  return HEAVY_PATTERNS.some(p => p.test(question));
}

// ============================================================
// DETERMINISTIC ENGINE
// ============================================================

function fingerprint(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h) + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function voteValue(v: VoteEnum): number {
  if (v === 'HARD_YES') return 2;
  if (v === 'SOFT_YES') return 1;
  if (v === 'THINK')    return 0;
  if (v === 'SOFT_NO')  return -1;
  if (v === 'HARD_NO')  return -2;
  return 0;
}

function aggregateNine(votes: CouncilResult[]): VerdictLevel {
  const total = votes.reduce((s, v) => s + voteValue(v.vote), 0);
  if (total >= 7)  return 'HARD_YES';
  if (total >= 2)  return 'SOFT_YES';
  if (total >= -2) return 'THINK';
  if (total >= -6) return 'SOFT_NO';
  return 'HARD_NO';
}

function buildVerdicts(question: string): { results: CouncilResult[]; verdict: VerdictLevel } {
  const fp = fingerprint(question);

  // Step 1: build the nine non-judge agents from the response bank
  const nine = COUNCIL.slice(0, 9).map((agent, i) => {
    const bank = RESPONSE_BANK[agent.id];
    const idx = (fp + i * 7919) % bank.length;
    return { agent, ...bank[idx] };
  });

  // Step 2: aggregate the nine to determine the actual outcome tier
  const tier = aggregateNine(nine);

  // Step 3: pick a Judge line from the tier-matching subset
  const judgeAgent = COUNCIL[9];
  const judgeBank = JUDGE_BANK[tier];
  const judgeIdx = (fp + 9 * 7919) % judgeBank.length;
  const judgeLine: CouncilResult = { agent: judgeAgent, vote: tier, say: judgeBank[judgeIdx] };

  return { results: [...nine, judgeLine], verdict: tier };
}

// ============================================================
// COLOR UTILITIES
// ============================================================

const colorMap: Record<AgentColor, { bg: string; border: string; text: string; dot: string }> = {
  cyan:    { bg: 'bg-cyan-950/40',    border: 'border-cyan-700/60',    text: 'text-cyan-300',    dot: 'bg-cyan-400'    },
  amber:   { bg: 'bg-amber-950/40',   border: 'border-amber-700/60',   text: 'text-amber-300',   dot: 'bg-amber-400'   },
  slate:   { bg: 'bg-slate-900/60',   border: 'border-slate-700/60',   text: 'text-slate-300',   dot: 'bg-slate-400'   },
  emerald: { bg: 'bg-emerald-950/40', border: 'border-emerald-700/60', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  rose:    { bg: 'bg-rose-950/40',    border: 'border-rose-700/60',    text: 'text-rose-300',    dot: 'bg-rose-400'    },
  pink:    { bg: 'bg-pink-950/40',    border: 'border-pink-700/60',    text: 'text-pink-300',    dot: 'bg-pink-400'    },
  indigo:  { bg: 'bg-indigo-950/40',  border: 'border-indigo-700/60',  text: 'text-indigo-300',  dot: 'bg-indigo-400'  },
  teal:    { bg: 'bg-teal-950/40',    border: 'border-teal-700/60',    text: 'text-teal-300',    dot: 'bg-teal-400'    },
  violet:  { bg: 'bg-violet-950/40',  border: 'border-violet-700/60',  text: 'text-violet-300',  dot: 'bg-violet-400'  },
  orange:  { bg: 'bg-orange-950/40',  border: 'border-orange-700/60',  text: 'text-orange-300',  dot: 'bg-orange-400'  },
};

const voteIcon: Record<VoteEnum, React.ElementType> = {
  HARD_YES: CheckCircle2, SOFT_YES: CheckCircle2, THINK: MinusCircle, SOFT_NO: XCircle, HARD_NO: XCircle,
};
const voteLabel: Record<VoteEnum, string> = {
  HARD_YES: 'STRONG YES', SOFT_YES: 'LEAN YES', THINK: 'THINK MORE', SOFT_NO: 'LEAN NO', HARD_NO: 'STRONG NO',
};
const voteColor: Record<VoteEnum, string> = {
  HARD_YES: 'text-emerald-300', SOFT_YES: 'text-teal-300', THINK: 'text-amber-300', SOFT_NO: 'text-orange-300', HARD_NO: 'text-rose-300',
};

// ============================================================
// TOAST
// ============================================================

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-700 text-slate-100 text-sm px-4 py-2.5 rounded-lg shadow-2xl shadow-black/40 flex items-center gap-2 animate-fade-in">
      <Check className="w-4 h-4 text-emerald-400" />
      {message}
    </div>
  );
}

// ============================================================
// MAIN
// ============================================================

export default function CouncilOf10() {
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<DeliberationPhase>('input');
  const [results, setResults] = useState<CouncilResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [verdict, setVerdict] = useState<VerdictLevel | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showMicNotice, setShowMicNotice] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Language redirect state
  const [detectedLang, setDetectedLang] = useState<string>('');
  const [langEmail, setLangEmail] = useState('');
  const [langChoice, setLangChoice] = useState('Arabic');
  const [langOther, setLangOther] = useState('');
  const [langSubmitted, setLangSubmitted] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submitSignal = (trpc as any).council.submitLanguageSignal.useMutation();

  // Check Web Speech API support on mount
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setSpeechSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

    // Show one-time privacy notice
    const seen = sessionStorage.getItem('council_mic_notice_seen');
    if (!seen) {
      setShowMicNotice(true);
      sessionStorage.setItem('council_mic_notice_seen', '1');
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    let finalText = question;
    rec.onresult = (event: { resultIndex: number; results: { isFinal: boolean; [k: number]: { transcript: string } }[] }) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) { finalText += t; }
        else { interim = t; }
      }
      setQuestion(finalText + interim);
    };
    rec.onend = () => { setIsListening(false); setQuestion(finalText); };
    rec.onerror = () => { setIsListening(false); };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [question]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const samples = [
    'Should I quit my job to start a company?',
    'Should I have a difficult conversation with my brother?',
    'Should I move to another country at 50?',
    'Should I tell my partner I am unhappy?',
    'Should I take the loan to renovate the house?',
  ];

  const run = () => {
    if (!question.trim()) return;
    const q = question.trim();

    // SCOPE 3: language detection FIRST
    const langResult = detectLanguage(q);
    if (langResult.lang !== 'english' && langResult.confidence >= 0.80) {
      const langNames: Record<string, string> = { arabic: 'Arabic', cjk: 'Mandarin', devanagari: 'Hindi', tamil: 'Tamil' };
      setDetectedLang(langNames[langResult.lang] || 'Other');
      setLangChoice(langNames[langResult.lang] || 'Other');
      setLangEmail('');
      setLangOther('');
      setLangSubmitted(false);
      setPhase('language');
      return;
    }

    // SCOPE 1: sensitive category check SECOND
    if (isHeavyCategory(q)) {
      setPhase('heavy');
      return;
    }

    const { results: built, verdict: finalVerdict } = buildVerdicts(q);
    setResults(built);
    setPhase('deliberating');
    setActiveIdx(0);

    built.forEach((_, i) => {
      setTimeout(() => setActiveIdx(i), (i + 1) * 700);
    });

    setTimeout(() => {
      setVerdict(finalVerdict);
      setPhase('verdict');
    }, (built.length + 1) * 700);
  };

  const reset = () => {
    setQuestion('');
    setPhase('input');
    setResults([]);
    setActiveIdx(-1);
    setVerdict(null);
    setDetectedLang('');
    setLangEmail('');
    setLangSubmitted(false);
  };

  const handleLangSignal = async () => {
    const lang = langChoice === 'Other' ? (langOther.trim() || 'Other') : langChoice;
    await submitSignal.mutateAsync({ language: lang, email: langEmail.trim() || undefined });
    setLangSubmitted(true);
  };

  const share = async () => {
    if (!verdict) return;
    const payload: SharePayload = {
      question,
      verdict,
      judgeText: results.find(r => r.agent.id === 'judge')?.say ?? '',
    };
    const text = `I asked The Council of 10: "${payload.question}"\n\nVerdict: ${VERDICTS[payload.verdict].label}\n\nThe Council of 10 — try it yourself.`;
    if (navigator.share) {
      try { await navigator.share({ text, title: 'The Council of 10 verdict' }); } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setToast('Verdict copied to clipboard');
      } catch {
        setToast('Could not copy — please copy manually');
      }
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-indigo-950/30 text-slate-100"
      style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}
    >
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in { animation: fade-in 200ms ease-out; }
      `}</style>

      {/* HEADER */}
      <header className="border-b border-slate-900/80 backdrop-blur-sm sticky top-0 z-10 bg-slate-950/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-50 tracking-tight">The Council of 10</div>
              <div className="text-[11px] text-slate-500">ten voices for one decision</div>
            </div>
          </div>
          {phase === 'verdict' && (
            <button
              onClick={reset}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Ask another
            </button>
          )}
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {phase === 'input' && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto pt-4 sm:pt-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 mb-6">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Ten voices. One verdict. The disagreement is the signal.
              </div>
              <h1 className="text-4xl sm:text-5xl font-semibold text-slate-50 tracking-tight leading-tight mb-5">
                Stuck on a decision?<br />
                <span className="bg-gradient-to-r from-cyan-300 via-indigo-300 to-violet-300 bg-clip-text text-transparent">
                  Convene The Council.
                </span>
              </h1>
              <p className="text-slate-400 leading-relaxed text-base sm:text-lg">
                Ten distinct voices — the Skeptic, the Heart, the Historian, the Devil's Advocate, and seven more — will weigh in on what you are facing. They will not agree. That is the point.
              </p>
            </div>

            <div className="max-w-2xl mx-auto w-full">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-1 shadow-2xl shadow-indigo-950/30">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }}
                  placeholder="What decision are you facing? Write it as a question — keep it personal, keep it real."
                  rows={3}
                  className="w-full bg-transparent text-slate-100 placeholder-slate-600 p-4 sm:p-5 outline-none resize-none text-base leading-relaxed"
                />
                <div className="flex items-center justify-between gap-3 p-2 pt-1 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] text-slate-500 px-2 font-mono">{question.length} chars</div>
                    {speechSupported && (
                      <button
                        onClick={isListening ? stopListening : startListening}
                        title={isListening ? 'Stop recording' : 'Speak your question'}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
                          isListening
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                        {isListening ? 'Stop' : 'Speak'}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={run}
                    disabled={!question.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-500 hover:from-cyan-400 hover:via-indigo-400 hover:to-violet-400 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                  >
                    Convene The Council
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {showMicNotice && (
                  <div className="mx-4 mb-3 mt-1 flex items-start gap-2 text-[11px] text-slate-500 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2">
                    <Mic className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-600" />
                    <span>Voice input is processed entirely in your browser. No audio is sent to any server.</span>
                    <button onClick={() => setShowMicNotice(false)} className="ml-auto text-slate-600 hover:text-slate-400 flex-shrink-0">✕</button>
                  </div>
                )}
              </div>

              <div className="mt-5">
                <div className="text-[11px] text-slate-500 uppercase tracking-widest mb-3 text-center">Or try one of these</div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {samples.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setQuestion(s)}
                      className="text-xs text-slate-300 bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-full px-3 py-1.5 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-w-3xl mx-auto pt-8">
              <div className="text-[11px] uppercase tracking-widest text-slate-500 text-center mb-5">The ten voices</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {COUNCIL.map((agent) => {
                  const c = colorMap[agent.color];
                  const Icon = agent.icon;
                  return (
                    <div key={agent.id} className={`${c.bg} border ${c.border} rounded-lg p-3 text-center`}>
                      <Icon className={`w-4 h-4 mx-auto mb-1.5 ${c.text}`} />
                      <div className="text-[11px] font-medium text-slate-200 leading-tight">{agent.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {phase === 'heavy' && (
          <div className="max-w-2xl mx-auto pt-8 sm:pt-16">
            <div className="bg-slate-900/60 border border-amber-700/40 rounded-xl p-6 sm:p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100 text-base">This question needs more than a council</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">The topic you raised involves real-world complexity that a thinking tool cannot address safely.</div>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                The Council of 10 is a decision-thinking tool. For questions involving personal safety, legal matters, medical situations, or family crises, please speak with a qualified professional.
              </p>
              <div className="space-y-3 mb-6">
                <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">If you need to talk to someone now</div>
                <a href="https://www.befrienders.org" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors group">
                  <Phone className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-slate-200 font-medium group-hover:text-white">Befrienders Worldwide</div>
                    <div className="text-[11px] text-slate-500">International emotional support — befrienders.org</div>
                  </div>
                </a>
                <a href="https://www.iasp.info/resources/Crisis_Centres/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors group">
                  <Globe className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-slate-200 font-medium group-hover:text-white">IASP Crisis Centres Directory</div>
                    <div className="text-[11px] text-slate-500">Find a crisis centre in your country — iasp.info</div>
                  </div>
                </a>
              </div>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-900 text-slate-300 text-sm transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Go back
              </button>
            </div>
          </div>
        )}

        {phase === 'language' && (
          <div className="max-w-2xl mx-auto pt-8 sm:pt-16">
            <div className="bg-slate-900/60 border border-indigo-700/40 rounded-xl p-6 sm:p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100 text-base">The Council speaks English for now</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">We detected your question may be in {detectedLang || 'another language'}.</div>
                </div>
              </div>

              {!langSubmitted ? (
                <>
                  <p className="text-sm text-slate-300 leading-relaxed mb-5">
                    The Council of 10 currently deliberates in English. We are building support for more languages — your signal helps us prioritise.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] uppercase tracking-widest text-slate-500 mb-2 block">Your language</label>
                      <div className="flex flex-wrap gap-2">
                        {['Arabic', 'Mandarin', 'Hindi', 'Tamil', 'Other'].map(l => (
                          <button
                            key={l}
                            onClick={() => setLangChoice(l)}
                            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                              langChoice === l
                                ? 'bg-indigo-500/30 border-indigo-500/60 text-indigo-200'
                                : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      {langChoice === 'Other' && (
                        <input
                          value={langOther}
                          onChange={e => setLangOther(e.target.value)}
                          placeholder="Which language?"
                          className="mt-2 w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500/60"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-widest text-slate-500 mb-2 block">Email (optional — we will notify you when your language is ready)</label>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-600 flex-shrink-0" />
                        <input
                          type="email"
                          value={langEmail}
                          onChange={e => setLangEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500/60"
                        />
                      </div>
                      <div className="text-[10px] text-slate-600 mt-1.5 ml-6">Your question is never stored. Only your language preference and email are saved.</div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={handleLangSignal}
                        disabled={submitSignal.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {submitSignal.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Send signal
                      </button>
                      <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-900 text-slate-300 text-sm transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Go back
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <div className="text-slate-200 font-medium mb-1">Signal received — thank you</div>
                  <div className="text-sm text-slate-500 mb-5">We will prioritise {langChoice === 'Other' ? (langOther || 'your language') : langChoice} support based on demand.</div>
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-900 text-slate-300 text-sm transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Ask a question in English
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {(phase === 'deliberating' || phase === 'verdict') && (
          <div className="space-y-6">
            <div className="max-w-3xl mx-auto bg-slate-900/40 border border-slate-800 rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">The question</div>
              <div className="text-base sm:text-lg text-slate-100 italic">"{question}"</div>
            </div>

            {phase === 'verdict' && verdict && (
              <div className="max-w-3xl mx-auto">
                <div className={`relative overflow-hidden rounded-xl border-2 ${VERDICTS[verdict].border} ${VERDICTS[verdict].tone} p-6 sm:p-8 shadow-2xl ${VERDICTS[verdict].glow}`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-12 translate-x-12" />
                  <div className="relative">
                    <div className={`text-xs uppercase tracking-widest ${VERDICTS[verdict].text} opacity-80 mb-2`}>Council verdict</div>
                    <div className={`text-5xl sm:text-6xl font-bold ${VERDICTS[verdict].text} tracking-tight mb-3`}>
                      {VERDICTS[verdict].label}
                    </div>
                    <div className={`text-sm ${VERDICTS[verdict].text} opacity-90 max-w-xl`}>
                      {results.find(r => r.agent.id === 'judge')?.say}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
                  <button
                    onClick={share}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-900 text-sm font-medium transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Share verdict
                  </button>
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-900 text-slate-300 text-sm transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Ask another
                  </button>
                </div>
              </div>
            )}

            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">The Council deliberates</div>
                {phase === 'deliberating' && (
                  <div className="flex items-center gap-2 text-[11px] text-cyan-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {activeIdx + 1} of {COUNCIL.length}
                  </div>
                )}
              </div>

              {results.map((r, i) => {
                const c = colorMap[r.agent.color];
                const Icon = r.agent.icon;
                const VIcon = voteIcon[r.vote];
                const isActive = i <= activeIdx;
                const isCurrent = i === activeIdx && phase === 'deliberating';
                return (
                  <div
                    key={r.agent.id}
                    className={`${c.bg} border ${c.border} rounded-lg p-4 transition-all duration-500 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-2'} ${isCurrent ? 'ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-500/10' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${c.bg} border ${c.border} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${c.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-slate-100">{r.agent.name}</div>
                            <div className="text-[11px] text-slate-500">· {r.agent.role}</div>
                          </div>
                          {isActive && (
                            <div className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${voteColor[r.vote]} font-mono uppercase tracking-wider`}>
                              <VIcon className="w-3 h-3" />
                              {voteLabel[r.vote]}
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <div className="text-sm text-slate-200 leading-relaxed">
                            <MessageSquare className={`w-3 h-3 inline mr-1.5 mb-0.5 ${c.text}`} />
                            "{r.say}"
                          </div>
                        )}
                        {!isActive && (
                          <div className="text-xs text-slate-600 italic">waiting to speak…</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {phase === 'verdict' && (
              <div className="max-w-3xl mx-auto pt-6 text-center">
                <div className="inline-flex items-center gap-2 text-[11px] text-slate-500">
                  <Scale className="w-3 h-3" />
                  the council disagreed. it always does. that is how good decisions are made.
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="mt-20 pt-8 border-t border-slate-900/80 text-center">
          <div className="text-[11px] text-slate-600 leading-relaxed max-w-lg mx-auto">
            The Council of 10 is a thinking tool, not advice. The voices are characters — use them to surface your own thinking, not to replace it.
          </div>
          <div className="text-[10px] text-slate-700 mt-4 tracking-widest">
            built by AgenThink · a gift
          </div>
        </footer>

      </main>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
