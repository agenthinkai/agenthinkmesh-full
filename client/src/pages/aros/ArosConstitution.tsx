/**
 * ArosConstitution.tsx — The AgenThink Mesh Constitution
 *
 * This page is the permanent reference document for Atlas.
 * It defines what Atlas is, what it produces, and the standards
 * every Executive Intelligence Brief must meet.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Brain, Target, CheckCircle2, ArrowRight, Repeat } from "lucide-react";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-12">
    <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500 mb-6">{title}</h2>
    {children}
  </section>
);

const Principle = ({ children }: { children: React.ReactNode }) => (
  <p className="text-slate-200 text-lg leading-relaxed mb-4 font-light">{children}</p>
);

const Question = ({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="mb-10">
    <div className="flex items-start gap-4 mb-3">
      <span className="text-xs font-mono text-slate-600 mt-1 w-6 flex-shrink-0">{number}</span>
      <h3 className="text-slate-100 font-semibold text-base tracking-wide">{title}</h3>
    </div>
    <div className="ml-10 space-y-2">{children}</div>
  </div>
);

const QuestionLine = ({ children }: { children: React.ReactNode }) => (
  <p className="text-slate-400 text-sm leading-relaxed">{children}</p>
);

const Test = ({
  number,
  condition,
  consequence,
}: {
  number: string;
  condition: string;
  consequence: string;
}) => (
  <div className="flex gap-4 mb-6">
    <div className="flex-shrink-0 w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center">
      <span className="text-xs font-mono text-slate-500">{number}</span>
    </div>
    <div>
      <p className="text-slate-200 text-sm mb-1">{condition}</p>
      <p className="text-red-400 text-xs font-mono">{consequence}</p>
    </div>
  </div>
);

const LoopStep = ({
  label,
  isLast,
}: {
  label: string;
  isLast?: boolean;
}) => (
  <div className="flex flex-col items-center">
    <div className="px-6 py-2 border border-slate-700 rounded-lg bg-slate-900/60 text-slate-300 text-sm font-light tracking-wide">
      {label}
    </div>
    {!isLast && (
      <div className="flex flex-col items-center my-1">
        <div className="w-px h-3 bg-slate-700" />
        <ArrowRight className="w-3 h-3 text-slate-600 rotate-90" />
      </div>
    )}
  </div>
);

export default function ArosConstitution() {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-3xl mx-auto px-6 py-16">

          {/* Header */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <BookOpen className="w-5 h-5 text-slate-500" />
              <Badge variant="outline" className="text-xs text-slate-500 border-slate-700 font-mono tracking-widest">
                CONSTITUTION
              </Badge>
            </div>
            <h1 className="text-4xl font-light text-slate-100 tracking-tight mb-4">
              AgenThink Mesh Constitution
            </h1>
            <p className="text-slate-500 text-sm font-light tracking-wide">
              The Executive Intelligence Network
            </p>
          </div>

          <Separator className="bg-slate-800 mb-16" />

          {/* Mission */}
          <Section title="Mission">
            <Principle>
              AgenThink Mesh exists to help the world's leaders make better strategic decisions
              before reality makes them for them.
            </Principle>
            <div className="mt-8 space-y-3 border-l-2 border-slate-800 pl-6">
              <p className="text-slate-500 text-sm">We do not sell artificial intelligence.</p>
              <p className="text-slate-500 text-sm">We do not sell software.</p>
              <p className="text-slate-500 text-sm">We do not sell reports.</p>
              <p className="text-slate-200 text-sm font-medium mt-6">We produce Executive Intelligence.</p>
            </div>
          </Section>

          <Separator className="bg-slate-800 mb-16" />

          {/* What We Believe */}
          <Section title="What We Believe">
            <Principle>
              Every institution is continuously making strategic decisions.
            </Principle>
            <Principle>
              Some become defining successes.
            </Principle>
            <Principle>
              Some become irreversible mistakes.
            </Principle>
            <Principle>
              Most organizations possess enormous amounts of information but very little structured
              decision intelligence.
            </Principle>
            <div className="mt-8 p-6 border border-slate-700/50 rounded-xl bg-slate-900/40">
              <p className="text-slate-200 text-base font-light leading-relaxed">
                Our purpose is to identify the decisions that matter before they become obvious.
              </p>
            </div>
          </Section>

          <Separator className="bg-slate-800 mb-16" />

          {/* The Atlas Principle */}
          <Section title="The Atlas Principle">
            <div className="flex items-center gap-3 mb-8">
              <Brain className="w-5 h-5 text-violet-400" />
              <p className="text-slate-300 text-sm">Atlas is not a sales engine.</p>
            </div>
            <p className="text-slate-200 text-lg font-light mb-8">
              Atlas is a continuously operating Executive Intelligence Network.
            </p>
            <p className="text-slate-400 text-sm mb-6">Its responsibility is to:</p>
            <div className="space-y-3 mb-10">
              {[
                "Observe the world.",
                "Detect strategic decisions.",
                "Build Decision Twins.",
                "Identify Hidden Variables.",
                "Monitor reality.",
                "Learn continuously.",
                "Deliver timely Executive Intelligence.",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-1 h-1 rounded-full bg-violet-500 flex-shrink-0" />
                  <p className="text-slate-300 text-sm">{item}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-slate-700/50 rounded-lg bg-slate-900/40 text-center">
                <p className="text-slate-500 text-xs mb-2">Consequence</p>
                <p className="text-slate-200 text-sm font-medium">Revenue</p>
              </div>
              <div className="p-4 border border-violet-700/40 rounded-lg bg-violet-900/10 text-center">
                <p className="text-slate-500 text-xs mb-2">Product</p>
                <p className="text-violet-300 text-sm font-medium">Intelligence</p>
              </div>
            </div>
          </Section>

          <Separator className="bg-slate-800 mb-16" />

          {/* Four Questions */}
          <Section title="Every Brief Must Answer Four Questions">
            <div className="flex items-center gap-2 mb-10">
              <Target className="w-4 h-4 text-amber-400" />
              <p className="text-slate-400 text-xs">These four questions are non-negotiable. A brief that cannot answer all four is not ready.</p>
            </div>

            <Question number="01" title="What strategic decision has Atlas detected?">
              <QuestionLine>Not a market trend.</QuestionLine>
              <QuestionLine>Not public news.</QuestionLine>
              <p className="text-slate-200 text-sm font-medium">A decision.</p>
            </Question>

            <Question number="02" title="What Hidden Variable is most likely to determine success or failure?">
              <QuestionLine>Only one.</QuestionLine>
              <QuestionLine>If Atlas cannot identify one, it has not thought deeply enough.</QuestionLine>
            </Question>

            <Question number="03" title="Why does this matter now?">
              <QuestionLine>Explain why timing matters.</QuestionLine>
              <QuestionLine>Explain why delay increases risk.</QuestionLine>
              <QuestionLine>Explain why the decision deserves attention.</QuestionLine>
            </Question>

            <Question number="04" title="What question should the executive now be asking?">
              <QuestionLine>Never end by asking for a meeting.</QuestionLine>
              <QuestionLine>End by changing how the executive thinks.</QuestionLine>
              <div className="mt-4 p-4 border border-slate-700/50 rounded-lg bg-slate-900/40 space-y-1">
                <p className="text-slate-400 text-xs">Curiosity creates conversations.</p>
                <p className="text-slate-400 text-xs">Conversations create relationships.</p>
                <p className="text-slate-300 text-xs font-medium">Relationships create customers.</p>
              </div>
            </Question>
          </Section>

          <Separator className="bg-slate-800 mb-16" />

          {/* Four Tests */}
          <Section title="Every Brief Must Pass Four Tests">
            <div className="flex items-center gap-2 mb-10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <p className="text-slate-400 text-xs">If any test fails, the brief is rejected and rewritten. No exceptions.</p>
            </div>

            <Test
              number="1"
              condition="Could this brief be sent to another company?"
              consequence="If yes — reject it."
            />
            <Test
              number="2"
              condition='Would the CEO say, "I had not considered that."'
              consequence="If no — reject it."
            />
            <Test
              number="3"
              condition="Does the brief create insight before asking for attention?"
              consequence="If no — reject it."
            />
            <Test
              number="4"
              condition="Would this still be valuable if AgenThink Mesh were never mentioned?"
              consequence="If no — reject it."
            />

            <div className="mt-8 p-6 border border-emerald-700/30 rounded-xl bg-emerald-900/10">
              <p className="text-emerald-300 text-sm font-light text-center tracking-wide">
                The intelligence must stand on its own.
              </p>
            </div>
          </Section>

          <Separator className="bg-slate-800 mb-16" />

          {/* Atlas Learning Loop */}
          <Section title="Atlas Learning Loop">
            <div className="flex items-center gap-2 mb-10">
              <Repeat className="w-4 h-4 text-blue-400" />
              <p className="text-slate-400 text-xs">Every interaction improves Atlas.</p>
            </div>

            <div className="flex flex-col items-center py-4">
              {["Observe", "Detect", "Predict", "Deliver", "Outcome", "Calibrate", "Learn"].map(
                (step, i, arr) => (
                  <LoopStep key={step} label={step} isLast={i === arr.length - 1} />
                )
              )}
              <div className="flex flex-col items-center mt-1">
                <div className="w-px h-3 bg-slate-700" />
                <div className="px-6 py-2 border border-blue-700/40 rounded-lg bg-blue-900/10 text-blue-300 text-sm font-light tracking-wide">
                  Repeat
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-3">
              <p className="text-slate-400 text-sm text-center">Every interaction improves Atlas.</p>
              <p className="text-slate-400 text-sm text-center">Every outcome strengthens the Decision Twin.</p>
              <p className="text-slate-300 text-sm text-center font-medium">
                Every calibrated prediction increases the value of the Outcome Ledger.
              </p>
            </div>
          </Section>

          <Separator className="bg-slate-800 mb-16" />

          {/* North Star */}
          <Section title="The Company's North Star">
            <p className="text-slate-400 text-sm mb-6">We are not building the world's largest AI company.</p>
            <div className="p-8 border border-slate-700/50 rounded-2xl bg-slate-900/40 text-center mb-10">
              <p className="text-slate-100 text-xl font-light leading-relaxed">
                We are building the world's most trusted
                <br />
                Executive Intelligence Network.
              </p>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              One day, institutions should ask a simple question before making an important strategic decision:
            </p>
            <div className="p-6 border border-violet-700/40 rounded-xl bg-violet-900/10 text-center mb-8">
              <p className="text-violet-200 text-lg font-light italic">
                "What does AgenThink Mesh think?"
              </p>
            </div>
            <div className="text-center">
              <p className="text-slate-500 text-sm">When that becomes normal,</p>
              <p className="text-slate-300 text-sm font-medium mt-1">the mission has been achieved.</p>
            </div>
          </Section>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-slate-800 flex items-center justify-between text-xs text-slate-700">
            <span>AgenThink Mesh Constitution</span>
            <span>Atlas AROS — Executive Intelligence Network</span>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
