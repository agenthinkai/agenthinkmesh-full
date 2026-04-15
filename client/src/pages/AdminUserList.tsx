/**
 * client/src/pages/AdminUserList.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-only page: audit log of all provisioned user accounts.
 * Route: /admin/users
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function AdminUserList() {
  const { user, isLoading } = useAuth();
  const { data: rows, isLoading: rowsLoading } = trpc.adminProvision.listProvisionedUsers.useQuery(
    undefined,
    { enabled: !!user && user.role === "admin" }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

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
          <span className="text-slate-300 text-xs uppercase tracking-widest font-bold">Provisioning Audit Log</span>
        </div>
        <Link href="/admin/users/create">
          <Button size="sm" className="bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs">
            + Create User
          </Button>
        </Link>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-wide">
            📋 Provisioned Users — Audit Log
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            All accounts created via admin provisioning. Sorted by creation date.
          </p>
        </div>

        {rowsLoading ? (
          <p className="text-slate-500 text-sm">Loading audit log…</p>
        ) : !rows || rows.length === 0 ? (
          <div className="border border-slate-800 rounded-lg p-8 text-center">
            <p className="text-slate-500 text-sm">No provisioned users yet.</p>
            <Link href="/admin/users/create">
              <Button size="sm" className="mt-4 bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs">
                + Create First User
              </Button>
            </Link>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 border-b border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-widest font-bold">Email</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-widest font-bold">Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-widest font-bold">Role</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-widest font-bold">Created By</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-widest font-bold">Created At (KWT)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-800 ${i % 2 === 0 ? "bg-slate-900" : "bg-slate-950"}`}
                  >
                    <td className="px-4 py-3 font-mono text-slate-200 text-xs">{row.createdEmail}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{row.createdName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                          row.assignedRole === "admin"
                            ? "bg-purple-900 text-purple-300"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {row.assignedRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                      {row.adminEmail ?? `ID:${row.adminId}`}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(row.createdAt).toLocaleString("en-KW", {
                        timeZone: "Asia/Kuwait",
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
