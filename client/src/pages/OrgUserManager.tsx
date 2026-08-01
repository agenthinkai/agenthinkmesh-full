/**
 * OrgUserManager — Sprint 3 WP-8
 * Enterprise admin page for managing org-level membership.
 * Allows admins to list, suspend, and reactivate members.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrgMember {
  membershipId: number;
  userId: number;
  roleId?: number | string | null;
  deptId?: number | null;
  jobTitle?: string | null;
  status: string;
  joinedAt?: Date | number | null;
  lastActiveAt?: Date | number | null;
  userName?: string | null;
  userEmail?: string | null;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-900 text-emerald-300",
    suspended: "bg-red-900 text-red-300",
    pending: "bg-amber-900 text-amber-300",
    inactive: "bg-slate-700 text-slate-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${map[status] ?? "bg-slate-700 text-slate-400"}`}>
      {status.toUpperCase()}
    </span>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    owner: "bg-indigo-900 text-indigo-300",
    admin: "bg-purple-900 text-purple-300",
    analyst: "bg-blue-900 text-blue-300",
    viewer: "bg-slate-700 text-slate-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${map[role] ?? "bg-slate-700 text-slate-400"}`}>
      {role}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OrgUserManager() {
  const { user } = useAuth();
  const orgId = 1; // Default org — in production from user's org membership

  const { data: members, isLoading, refetch } = trpc.enterprise.listOrgMembers.useQuery({ orgId });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    member: OrgMember | null;
    action: "suspend" | "reactivate" | "update";
    newRole?: string;
  }>({ open: false, member: null, action: "suspend" });

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");

  const suspendMutation = trpc.enterprise.suspendMembership.useMutation({
    onSuccess: () => {
      toast.success(`${confirmDialog.member?.userName ?? "Member"} has been suspended.`);
      setConfirmDialog({ open: false, member: null, action: "suspend" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const reactivateMutation = trpc.enterprise.reactivateMembership.useMutation({
    onSuccess: () => {
      toast.success(`${confirmDialog.member?.userName ?? "Member"} has been reactivated.`);
      setConfirmDialog({ open: false, member: null, action: "reactivate" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.enterprise.updateMembership.useMutation({
    onSuccess: () => {
      toast.success("Membership updated");
      setConfirmDialog({ open: false, member: null, action: "update" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  void updateMutation; // suppress unused warning — reserved for role update flow

  const handleConfirm = () => {
    if (!confirmDialog.member) return;
    if (confirmDialog.action === "suspend") {
      suspendMutation.mutate({ membershipId: confirmDialog.member.membershipId, orgId });
    } else if (confirmDialog.action === "reactivate") {
      reactivateMutation.mutate({ membershipId: confirmDialog.member.membershipId, orgId });
    } else if (confirmDialog.action === "update" && confirmDialog.newRole) {
      updateMutation.mutate({
        membershipId: confirmDialog.member.membershipId,
        orgId,
        status: confirmDialog.member.status as "active" | "suspended" | "invited",
      });
    }
  };

  const isPending = suspendMutation.isPending || reactivateMutation.isPending || updateMutation.isPending;

  const filteredMembers = (members ?? []).filter((m: OrgMember) => {
    if (filterStatus !== "all" && m.status !== filterStatus) return false;
    if (filterRole !== "all" && m.roleId !== filterRole) return false;
    return true;
  });

  const activeCount = (members ?? []).filter((m: OrgMember) => m.status === "active").length;
  const suspendedCount = (members ?? []).filter((m: OrgMember) => m.status === "suspended").length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/95 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/enterprise">
              <button className="text-slate-400 hover:text-white text-sm">← Enterprise</button>
            </Link>
            <div className="w-px h-4 bg-slate-700" />
            <div>
              <h1 className="text-base font-bold text-white">Org User Manager</h1>
              <p className="text-slate-400 text-xs mt-0.5">{user?.name ?? "Admin"} · Org #{orgId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400">
              <span className="text-emerald-400 font-mono">{activeCount}</span> active ·{" "}
              <span className="text-red-400 font-mono">{suspendedCount}</span> suspended
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Status:</span>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white text-xs h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 text-white">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Role:</span>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white text-xs h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 text-white">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="analyst">Analyst</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-slate-500 ml-auto">
            {filteredMembers.length} of {(members ?? []).length} members
          </span>
        </div>

        {/* Member Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-slate-800 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="border border-dashed border-slate-700 rounded-lg p-12 text-center">
            <p className="text-slate-500 text-sm">No members match the current filters.</p>
          </div>
        ) : (
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60">
                  <th className="text-left px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Joined</th>
                  <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member: OrgMember) => (
                  <tr key={member.membershipId} className="border-b border-slate-700/50 hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium text-sm">{member.userName ?? `User #${member.userId}`}</p>
                        {member.userEmail && <p className="text-slate-500 text-xs">{member.userEmail}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={String(member.roleId ?? "viewer")} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {member.joinedAt
                        ? (member.joinedAt instanceof Date ? member.joinedAt : new Date(member.joinedAt as number)).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {member.status === "active" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDialog({ open: true, member, action: "suspend" })}
                            className="text-xs h-7 border-red-800 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                          >
                            Suspend
                          </Button>
                        ) : member.status === "suspended" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDialog({ open: true, member, action: "reactivate" })}
                            className="text-xs h-7 border-emerald-800 text-emerald-400 hover:bg-emerald-900/30 hover:text-emerald-300"
                          >
                            Reactivate
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && setConfirmDialog({ open: false, member: null, action: "suspend" })}
      >
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              {confirmDialog.action === "suspend" ? "Suspend Member" : "Reactivate Member"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-300">
            {confirmDialog.action === "suspend" ? (
              <p>
                Are you sure you want to suspend{" "}
                <span className="font-semibold text-white">{confirmDialog.member?.userName ?? "this member"}</span>?
                They will lose access to all org resources immediately.
              </p>
            ) : (
              <p>
                Reactivate{" "}
                <span className="font-semibold text-white">{confirmDialog.member?.userName ?? "this member"}</span>?
                They will regain access to all org resources.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDialog({ open: false, member: null, action: "suspend" })}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={isPending}
              className={
                confirmDialog.action === "suspend"
                  ? "bg-red-700 hover:bg-red-800 text-white"
                  : "bg-emerald-700 hover:bg-emerald-800 text-white"
              }
            >
              {isPending
                ? "Processing…"
                : confirmDialog.action === "suspend"
                ? "Confirm Suspend"
                : "Confirm Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
