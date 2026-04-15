/**
 * client/src/pages/AdminUserCreate.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-only page: provision a new user account with a temporary password.
 * Route: /admin/users/create
 *
 * Security: renders a 403 gate if the current user is not an admin.
 * Not linked from public navigation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreatedCredentials {
  email: string;
  name: string | null;
  role: "user" | "admin";
  temporaryPassword: string;
}

// ─── Copy helper ──────────────────────────────────────────────────────────────

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard.`);
  } catch {
    toast.error("Copy failed — please copy manually.");
  }
}

// ─── Credentials panel ────────────────────────────────────────────────────────

function CredentialsPanel({
  creds,
  onCreateAnother,
}: {
  creds: CreatedCredentials;
  onCreateAnother: () => void;
}) {
  const both = `Email: ${creds.email}\nTemporary Password: ${creds.temporaryPassword}`;

  return (
    <div className="border border-green-700 bg-green-950/40 rounded-lg p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-green-400 text-lg font-black">✓ ACCOUNT CREATED</span>
      </div>
      <p className="text-slate-400 text-xs">
        Share these credentials securely. The temporary password is displayed{" "}
        <strong className="text-amber-400">once only</strong> and will expire in{" "}
        <strong className="text-amber-400">7 days</strong>. The user will be forced to change
        it on first login.
      </p>

      {/* Credential rows */}
      <div className="space-y-3">
        {/* Email */}
        <div className="bg-slate-800 rounded p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-0.5">Email</p>
            <p className="text-slate-100 font-mono text-sm truncate">{creds.email}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs shrink-0"
            onClick={() => copyToClipboard(creds.email, "Email")}
          >
            Copy Email
          </Button>
        </div>

        {/* Password */}
        <div className="bg-slate-800 rounded p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-0.5">
              Temporary Password
            </p>
            <p className="text-amber-300 font-mono text-sm tracking-wider">{creds.temporaryPassword}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs shrink-0"
            onClick={() => copyToClipboard(creds.temporaryPassword, "Password")}
          >
            Copy Password
          </Button>
        </div>

        {/* Role badge */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Role assigned:</span>
          <span
            className={`px-2 py-0.5 rounded font-bold uppercase tracking-wide ${
              creds.role === "admin"
                ? "bg-purple-900 text-purple-300"
                : "bg-slate-700 text-slate-300"
            }`}
          >
            {creds.role}
          </span>
          {creds.name && (
            <>
              <span className="text-slate-500">· Name:</span>
              <span className="text-slate-300">{creds.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Copy both */}
      <Button
        className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs tracking-wide"
        onClick={() => copyToClipboard(both, "Credentials")}
      >
        📋 Copy Both (Email + Password)
      </Button>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
          onClick={onCreateAnother}
        >
          + Create Another User
        </Button>
        <Link href="/admin/users">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
          >
            View Audit Log →
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminUserCreate() {
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [created, setCreated] = useState<CreatedCredentials | null>(null);

  const createMutation = trpc.adminProvision.createUser.useMutation({
    onSuccess: (data) => {
      setCreated({
        email: data.email,
        name: data.name,
        role: data.role,
        temporaryPassword: data.temporaryPassword,
      });
      toast.success(`User ${data.email} provisioned successfully.`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    createMutation.mutate({ email: email.trim(), name: name.trim() || undefined, role });
  };

  const handleCreateAnother = () => {
    setCreated(null);
    setEmail("");
    setName("");
    setRole("user");
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  // ── Auth gate ────────────────────────────────────────────────────────────
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-400 text-4xl font-black">403</p>
          <p className="text-slate-400 text-sm">Admin access required.</p>
          <Link href="/">
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700 mt-2">
              ← Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top bar */}
      <div className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <span className="text-slate-500 text-xs hover:text-slate-300 cursor-pointer">← HOME</span>
          </Link>
          <span className="text-slate-700">·</span>
          <span className="text-slate-400 text-xs uppercase tracking-widest">Admin Panel</span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-300 text-xs uppercase tracking-widest font-bold">User Provisioning</span>
        </div>
        <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
          ADMIN ONLY
        </span>
      </div>

      {/* Content */}
      <div className="max-w-xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-wide">
            🔐 Create User Account
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Provision a new user account. A secure temporary password will be generated automatically.
            The user must change it on first login.
          </p>
        </div>

        {created ? (
          <CredentialsPanel creds={created} onCreateAnother={handleCreateAnother} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-300 text-xs uppercase tracking-widest">
                User Email <span className="text-red-400">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500"
              />
            </div>

            {/* Display name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-slate-300 text-xs uppercase tracking-widest">
                Display Name <span className="text-slate-600">(optional)</span>
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g. Fatima Al-Rashid"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-blue-500"
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs uppercase tracking-widest">
                Role / Access Level
              </Label>
              <div className="flex gap-3">
                {(["user", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wide border transition-colors ${
                      role === r
                        ? r === "admin"
                          ? "bg-purple-900 border-purple-600 text-purple-200"
                          : "bg-blue-900 border-blue-600 text-blue-200"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {r === "admin" ? "🛡 Admin" : "👤 User"}
                  </button>
                ))}
              </div>
              {role === "admin" && (
                <p className="text-amber-400 text-xs mt-1">
                  ⚠ Admin users have full access to all admin panels and provisioning features.
                </p>
              )}
            </div>

            {/* Security notice */}
            <div className="bg-slate-800/60 border border-slate-700 rounded p-3 text-xs text-slate-400 space-y-1">
              <p className="font-bold text-slate-300">Security notes:</p>
              <p>· Password is generated randomly (16+ chars, all character classes)</p>
              <p>· Password is hashed in the database — plaintext shown only once</p>
              <p>· Temporary password expires in 7 days if unused</p>
              <p>· User is forced to change password on first login</p>
              <p>· This action is audit-logged with your admin ID and timestamp</p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={createMutation.isPending || !email.trim()}
              className="w-full bg-blue-700 hover:bg-blue-600 text-white font-black text-sm tracking-wide"
            >
              {createMutation.isPending ? "Creating Account…" : "🔐 Create User"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
