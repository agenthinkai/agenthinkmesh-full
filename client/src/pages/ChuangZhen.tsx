/**
 * ChuangZhen — 创诊 diaspora landing page at /chuangzhen
 *
 * Standalone page — does NOT touch the root homepage.
 * Target: overseas Chinese founders (SG, HK, MY, US, CA, AU).
 * Copy from Block 1 of 创诊_Diaspora_Unit_Kit.md.
 *
 * Rules:
 *   - NO mainland China references
 *   - NO WeChat login
 *   - NO ICP / 备案 mentions
 *   - Mobile-first
 *   - Free diagnostic CTA → existing DiagnosticFlow engine (Chinese input supported)
 *   - Stripe checkout: $14 deep report / $39/month AI Partner
 *   - Email signup captured via DiagnosticFlow's built-in gate + captureLead procedure
 */
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DiagnosticFlow from "@/components/DiagnosticFlow";

// ── Analytics helper ──────────────────────────────────────────────────────────
function trackEvent(name: string, props?: Record<string, unknown>) {
  try {
    const w = window as any;
    if (w.umami?.track) w.umami.track(name, props);
    if (w.gtag) w.gtag("event", name, props);
  } catch { /* non-fatal */ }
}

// ── Pricing card ──────────────────────────────────────────────────────────────
function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  highlight,
  onCta,
  loading,
}: {
  name: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  onCta?: () => void;
  loading?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col gap-4 ${
        highlight
          ? "border-cyan-400/40 bg-cyan-400/5"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{name}</div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-black text-white">{price}</span>
          {period && <span className="text-sm text-slate-500 mb-1">{period}</span>}
        </div>
      </div>
      <ul className="space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
            <svg
              className="mt-0.5 flex-shrink-0 text-cyan-400"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onCta}
        disabled={loading}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
          highlight
            ? "bg-cyan-500 hover:bg-cyan-400 text-white"
            : "border border-white/20 hover:border-white/40 text-slate-300 hover:text-white"
        }`}
      >
        {loading ? "…" : cta}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ChuangZhen() {
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Handle Stripe return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      const product = params.get("product");
      toast.success(
        product === "ai_partner"
          ? "🎉 欢迎加入AI合伙人计划！"
          : "🎉 深度诊断报告已解锁，请查收邮件。"
      );
      trackEvent("checkout_success", { product, lang: "zh", source: "chuangzhen" });
      window.history.replaceState({}, "", "/chuangzhen");
    } else if (params.get("canceled") === "1") {
      toast("已取消支付。如需帮助请联系我们。");
      window.history.replaceState({}, "", "/chuangzhen");
    }
  }, []);

  const checkoutMutation = trpc.diagnosis.createCheckout.useMutation({
    onSuccess: (data) => {
      setCheckoutLoading(null);
      if (data.url) {
        trackEvent("checkout_redirect", { product: checkoutLoading, lang: "zh", source: "chuangzhen" });
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      setCheckoutLoading(null);
      toast.error(err.message ?? "支付跳转失败，请重试。");
    },
  });

  function handleCheckout(product: "deep_report" | "ai_partner") {
    setCheckoutLoading(product);
    trackEvent("checkout_started", { product, lang: "zh", source: "chuangzhen" });
    // Pass /chuangzhen as origin path so Stripe redirects back here
    checkoutMutation.mutate({
      product,
      origin: window.location.origin + "/chuangzhen",
    });
  }

  return (
    <div
      className="min-h-screen bg-[#080D1A] text-slate-100"
      lang="zh-Hans"
      style={{ fontFamily: "'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', sans-serif" }}
    >
      {/* Google Font for Chinese */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=swap');`}</style>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-[#080D1A]/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <Link href="/chuangzhen" className="flex items-center gap-2 text-white font-bold text-base tracking-tight">
          <span className="text-cyan-400">创诊</span>
          <span className="text-slate-400 font-normal text-sm">AgenThinkMesh</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/founder" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            English
          </Link>
          <a href="#pricing" className="text-xs text-slate-400 hover:text-white transition-colors">
            定价
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-4 py-1.5 text-xs text-cyan-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          免费 · 无需注册 · 支持中文输入
        </div>

        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight mb-5">
          你的创业想法，<br />
          <span className="text-cyan-400">真的经得起推敲吗？</span>
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-2xl mx-auto">
          90% 的创业失败，原因只有一个：创始人从未真正验证过自己的假设。
          输入你的想法，60 秒后获得一份投资人视角的冷峻诊断——不是鼓励，是答案。
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 mb-10">
          <span>✓ 已帮助 12,000+ 位创始人识别关键漏洞</span>
          <span className="hidden sm:inline">·</span>
          <span>✓ 平均节省 6 个月试错成本</span>
          <span className="hidden sm:inline">·</span>
          <span>✓ 免费，无需注册</span>
        </div>

        {/* ── Free Diagnostic CTA — wired to existing engine ── */}
        <div className="bg-white/3 border border-white/10 rounded-2xl p-6 text-left">
          <DiagnosticFlow lang="zh" buSource="chuangzhen" />
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="border-y border-white/5 bg-white/2 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-slate-500">
          {[
            "🇸🇬 新加坡创始人社区",
            "🇭🇰 香港科技生态",
            "🇲🇾 马来西亚华人创业圈",
            "🇺🇸 北美华人创始人",
            "🇨🇦 加拿大创业孵化器",
            "🇦🇺 澳洲华人科技社区",
          ].map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white text-center mb-10">三步流程</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              n: "01",
              title: "输入想法",
              body: "用大白话描述你的创业点子，不需要商业计划书，中英文均可。",
            },
            {
              n: "02",
              title: "深度拆解",
              body: "从商业模式、市场容量、竞争壁垒、现金流四个维度进行投资人级压力测试。",
            },
            {
              n: "03",
              title: "拿到诊断",
              body: "不是\u201C加油你可以的\u201D，是\u201C第3个假设有致命漏洞，这是修补方案\u201D。",
            },
          ].map((s) => (
            <div key={s.n} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="text-3xl font-black text-cyan-400/30 font-mono mb-3">{s.n}</div>
              <h3 className="text-sm font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white text-center mb-10">
          其他 AI 工具 vs <span className="text-cyan-400">创诊</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 pr-6 text-slate-500 font-normal">其他 AI 工具说…</th>
                <th className="text-left py-3 text-cyan-300 font-semibold">创诊说…</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                ["这个想法很棒！", "你的目标市场规模被高估了 3 倍"],
                ["生成专业模板", "指出 3 个最致命的逻辑漏洞"],
                ["让你感觉良好", "让你准备好面对投资人的尖锐问题"],
                ["通用框架套用", "针对你的具体假设给出具体批评"],
              ].map(([other, ours], i) => (
                <tr key={i}>
                  <td className="py-3 pr-6 text-slate-500">{other}</td>
                  <td className="py-3 text-slate-200">{ours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white text-center mb-3">定价</h2>
        <p className="text-sm text-slate-400 text-center mb-10">
          免费开始。需要完整报告时再付费。
        </p>
        <div className="grid sm:grid-cols-3 gap-5">
          {/* Free tier */}
          <PricingCard
            name="免费版"
            price="$0"
            features={[
              "基础压力测试",
              "4 维度评分",
              "3 大风险识别（标题）",
              "无需注册",
            ]}
            cta="免费验证我的想法 →"
            onCta={() => {
              trackEvent("free_cta_click", { source: "pricing", lang: "zh", page: "chuangzhen" });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
          {/* $14 deep report */}
          <PricingCard
            name="深度诊断"
            price="$14"
            period="/次"
            highlight
            features={[
              "完整漏洞分析（原因 + 修补）",
              "行业对标",
              "投资人 Q&A 模拟",
              "PDF 报告",
            ]}
            cta="获取深度诊断 →"
            onCta={() => handleCheckout("deep_report")}
            loading={checkoutLoading === "deep_report"}
          />
          {/* $39/month AI Partner */}
          <PricingCard
            name="AI 合伙人"
            price="$39"
            period="/月"
            features={[
              "无限次深度诊断",
              "持续决策支持",
              "每周执行追踪",
              "优先体验新功能",
            ]}
            cta="开始 AI 合伙人 →"
            onCta={() => handleCheckout("ai_partner")}
            loading={checkoutLoading === "ai_partner"}
          />
        </div>
        <p className="text-center text-xs text-slate-600 mt-6">
          支持 Visa / Mastercard / American Express · 安全支付由 Stripe 处理
        </p>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white text-center mb-10">常见问题</h2>
        <div className="space-y-5">
          {[
            {
              q: "数据安全吗？",
              a: "数据加密存储于国际云服务器（新加坡节点），不会被用于模型训练，可随时一键删除。",
            },
            {
              q: "支持中文输入吗？",
              a: "完全支持简体中文、繁体中文及中英混合输入，报告语言随输入语言自动切换。",
            },
            {
              q: "适合什么阶段的创始人？",
              a: "从\u201C只有一个模糊想法\u201D到\u201C准备融资路演\u201D都适用，专为 Pre-A 轮及以前的创始人设计。",
            },
            {
              q: "这是真正的投资人分析吗？",
              a: "这是基于早期投资人评估框架的 AI 压力测试。它不能替代真实 IC，但会提前暴露投资人会问的同款问题。",
            },
            {
              q: "如何获取深度报告？",
              a: "免费诊断完成后，点击定价区域的\u201C获取深度诊断\u201D，通过 Stripe 支付 $14 即可解锁完整报告并发送至您的邮箱。",
            },
          ].map((item) => (
            <div key={item.q} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="text-sm font-semibold text-white mb-2">{item.q}</div>
              <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-white/10 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          别让"感觉不错"毁掉你的 6 个月。
        </h2>
        <p className="text-slate-400 text-sm mb-8">
          诊断是免费的。跳过它的代价不是。
        </p>
        <button
          onClick={() => {
            trackEvent("final_cta_click", { lang: "zh", page: "chuangzhen" });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
        >
          免费验证我的想法 →
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-slate-600">
        <p>
          © 2026 AgenThinkMesh ·{" "}
          <Link href="/terms" className="hover:text-slate-400 transition-colors">
            服务条款
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:text-slate-400 transition-colors">
            隐私政策
          </Link>
          {" · "}
          <Link href="/founder" className="hover:text-slate-400 transition-colors">
            English
          </Link>
          {" · "}
          <Link href="/zh" className="hover:text-slate-400 transition-colors">
            /zh
          </Link>
        </p>
      </footer>
    </div>
  );
}
