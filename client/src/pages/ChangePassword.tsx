/**
 * client/src/pages/ChangePassword.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Password change page for provisioned users.
 * Route: /account/change-password
 *
 * Two modes:
 *  1. Forced reset (mustResetPassword = true): user cannot navigate away until
 *     they set a new password.
 *  2. Voluntary change: accessible from account settings.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

// ─── Password strength indicator ─────────────────────────────────────────────

function StrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"];

  if (!password) return null;

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= score ? colors[score] : "bg-slate-700"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${score >= 4 ? "text-green-400" : "text-slate-500"}`}>
        {labels[score]}
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChangePassword() {
  const [, navigate] = useLocation();
  const { user, isLoading } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [done, setDone] = useState(false);

  const utils = trpc.useUtils();

  const changeMutation = trpc.adminProvision.changePassword.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setDone(true);
      toast.success("Password changed successfully.");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    changeMutation.mutate({ currentPassword, newPassword });
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  // ── Not a provisioned user ────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-sm">You must be signed in to change your password.</p>
          <Link href="/login/password">
            <Button size="sm" className="bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs">
              Sign In →
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isForced = (user as any).mustResetPassword === true;

  // ── Success state ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-black text-slate-100">Password Updated</h1>
          <p className="text-slate-400 text-sm">
            Your password has been changed successfully. You can now access the platform.
          </p>
          <Button
            className="w-full bg-blue-700 hover:bg-blue-600 text-white font-black text-sm"
            onClick={() => navigate("/")}
          >
            Continue to Platform →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          {isForced ? (
            <>
              <div className="inline-flex items-center gap-2 bg-amber-900/40 border border-amber-700 text-amber-300 text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wide">
                ⚠ Password Reset Required
              </div>
              <h1 className="text-2xl font-black text-slate-100">Set Your Password</h1>
              <p className="text-slate-400 text-sm">
                Your account was provisioned with a temporary password. You must set a permanent
                password before continuing.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black text-slate-100">Change Password</h1>
              <p className="text-slate-400 text-sm">Update your account password.</p>
            </>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current password */}
          <div className="space-y-1.5">
            <Label htmlFor="current" className="text-slate-300 text-xs uppercase tracking-widest">
              {isForced ? "Temporary Password" : "Current Password"}
            </Label>
            <div className="relative">
              <Input
                id="current"
                type={showCurrent ? "text" : "password"}
                required
                autoFocus
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                {showCurrent ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="new" className="text-slate-300 text-xs uppercase tracking-widest">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new"
                type={showNew ? "text" : "password"}
                required
                placeholder="Min 8 chars, mixed case, number, symbol"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
            <StrengthBar password={newPassword} />
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-slate-300 text-xs uppercase tracking-widest">
              Confirm New Password
            </Label>
            <Input
              id="confirm"
              type="password"
              required
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500 ${
                confirmPassword && confirmPassword !== newPassword
                  ? "border-red-600"
                  : confirmPassword && confirmPassword === newPassword
                  ? "border-green-600"
                  : ""
              }`}
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-red-400 text-xs">Passwords do not match.</p>
            )}
          </div>

          {/* Requirements */}
          <div className="bg-slate-800/60 border border-slate-700 rounded p-3 text-xs text-slate-400 space-y-0.5">
            {[
              { label: "At least 8 characters", ok: newPassword.length >= 8 },
              { label: "Uppercase letter", ok: /[A-Z]/.test(newPassword) },
              { label: "Lowercase letter", ok: /[a-z]/.test(newPassword) },
              { label: "Number", ok: /[0-9]/.test(newPassword) },
              { label: "Special character (!@#$%…)", ok: /[^A-Za-z0-9]/.test(newPassword) },
            ].map(({ label, ok }) => (
              <p key={label} className={ok ? "text-green-400" : "text-slate-500"}>
                {ok ? "✓" : "·"} {label}
              </p>
            ))}
          </div>

          <Button
            type="submit"
            disabled={
              changeMutation.isPending ||
              !currentPassword ||
              !newPassword ||
              newPassword !== confirmPassword
            }
            className="w-full bg-blue-700 hover:bg-blue-600 text-white font-black text-sm tracking-wide"
          >
            {changeMutation.isPending ? "Updating…" : "Set New Password →"}
          </Button>
        </form>

        {/* Back link (only for voluntary change) */}
        {!isForced && (
          <div className="text-center">
            <Link href="/">
              <span className="text-slate-500 text-xs hover:text-slate-300 cursor-pointer">← Back to Home</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
