/**
 * client/src/pages/PasswordLogin.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Login page for admin-provisioned users (email + temporary password).
 * Route: /login/password
 *
 * After successful login:
 *  - If mustResetPassword → redirect to /account/change-password
 *  - Otherwise → redirect to /
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function PasswordLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const utils = trpc.useUtils();

  const loginMutation = trpc.adminProvision.loginWithPassword.useMutation({
    onSuccess: async (data) => {
      // Invalidate auth cache so useAuth() picks up the new session
      await utils.auth.me.invalidate();
      if (data.mustResetPassword) {
        toast.info("Please set a new password before continuing.");
        navigate("/account/change-password");
      } else {
        navigate("/");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    loginMutation.mutate({ email: email.trim(), password });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / title */}
        <div className="text-center space-y-2">
          <p className="text-slate-500 text-xs uppercase tracking-widest">AgenThink Mesh</p>
          <h1 className="text-2xl font-black text-slate-100">Sign In</h1>
          <p className="text-slate-500 text-sm">Use the credentials provided by your administrator.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-300 text-xs uppercase tracking-widest">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-300 text-xs uppercase tracking-widest">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="Temporary or permanent password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loginMutation.isPending || !email.trim() || !password}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white font-black text-sm tracking-wide"
          >
            {loginMutation.isPending ? "Signing in…" : "Sign In →"}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-slate-600 text-xs">or</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        {/* OAuth link */}
        <div className="text-center">
          <Link href="/">
            <span className="text-blue-400 text-sm hover:text-blue-300 cursor-pointer">
              Sign in with Manus OAuth →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
