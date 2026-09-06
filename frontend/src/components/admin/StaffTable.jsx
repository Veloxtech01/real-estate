"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { FiSlash, FiRotateCcw } from "react-icons/fi";

import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import { updateStaffMember } from "@/lib/api/admin";
import { humanise } from "@/lib/format";

/**
 * The staff roster table.
 *
 * Deactivate/reactivate replaces delete/restore — an Agent record is never deleted,
 * since Property/Enquiry/Viewing/Testimonial all reference it. Mutations call the API
 * directly and then ask the page to refetch, the same no-optimistic-updates rule as
 * every other admin table.
 *
 * Takes: staff (array), onChanged (function — refetch).
 */
export default function StaffTable({ staff = [], onChanged }) {
  const { user } = useAdminSession();

  // The row awaiting deactivation confirmation, or null.
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const [busyId, setBusyId] = useState(null);

  /** Runs a row mutation, then refetches. */
  const run = async (id, action, successMessage) => {
    setBusyId(id);
    try {
      await action();
      toast.success(successMessage);
      await onChanged?.();
    } catch (error) {
      // Shown verbatim: a 400 here is the self-deactivation/self-demotion guard
      // speaking, and the message should read exactly as the API worded it.
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  if (staff.length === 0) {
    return <p className="p-8 text-center text-sm text-muted">No staff accounts yet.</p>;
  }

  return (
    <>
      {/* Horizontal scroll lives on the table's own wrapper, so the page body never
          scrolls sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-[0.06em] text-muted">
              <th scope="col" className="p-3 font-medium">Name</th>
              <th scope="col" className="p-3 font-medium">Email</th>
              <th scope="col" className="p-3 font-medium">Role</th>
              <th scope="col" className="p-3 font-medium">Position</th>
              <th scope="col" className="p-3 font-medium">Status</th>
              <th scope="col" className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {staff.map((member) => {
              // Server-enforced too — hiding the control here is courtesy, matching
              // the rest of the panel's role-gating convention.
              const isSelf = String(member._id) === String(user._id);
              const busy = busyId === member._id;

              return (
                <tr
                  key={member._id}
                  className={`border-b border-border ${member.isActive ? "" : "opacity-55"}`}
                >
                  <td className="p-3">
                    <Link
                      href={`/admin/staff/${member._id}`}
                      className="text-ink transition-colors duration-200 hover:text-accent-text"
                    >
                      {member.name}
                    </Link>
                    {isSelf && <span className="ml-2 text-xs text-muted">(you)</span>}
                  </td>

                  <td className="p-3 text-ink-soft">{member.email}</td>
                  <td className="p-3 text-ink-soft">{humanise(member.role)}</td>
                  <td className="p-3 text-ink-soft">{member.position || "—"}</td>

                  <td className="p-3">
                    <Badge tone={member.isActive ? "accent" : "muted"}>
                      {member.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>

                  <td className="p-3">
                    <div className="flex justify-end">
                      {!isSelf &&
                        (member.isActive ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPendingDeactivate(member)}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted transition-colors duration-200 hover:bg-ink/5 hover:text-danger disabled:cursor-not-allowed"
                          >
                            <FiSlash size={16} aria-hidden="true" />
                            <span className="sr-only">Deactivate {member.name}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                member._id,
                                () => updateStaffMember(member._id, { isActive: true }),
                                "Account reactivated",
                              )
                            }
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted transition-colors duration-200 hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed"
                          >
                            <FiRotateCcw size={16} aria-hidden="true" />
                            <span className="sr-only">Reactivate {member.name}</span>
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Deactivation is fully reversible — unlike a lead's hard delete, the wording
          here must say so plainly. */}
      <ConfirmDialog
        open={Boolean(pendingDeactivate)}
        title={`Deactivate ${pendingDeactivate?.name ?? ""}?`}
        body="They will no longer be able to sign in, and their public team profile is hidden. You can reactivate them from this table at any time."
        confirmLabel="Deactivate"
        loading={busyId === pendingDeactivate?._id}
        onCancel={() => setPendingDeactivate(null)}
        onConfirm={async () => {
          const target = pendingDeactivate;
          await run(
            target._id,
            () => updateStaffMember(target._id, { isActive: false }),
            "Account deactivated",
          );
          setPendingDeactivate(null);
        }}
      />
    </>
  );
}
