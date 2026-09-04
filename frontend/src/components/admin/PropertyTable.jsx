"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { FiStar, FiTrash2, FiRotateCcw, FiImage } from "react-icons/fi";

import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import { deleteProperty, restoreProperty, featureProperty } from "@/lib/api/admin";
import { formatMoney, formatRentPeriod, humanise } from "@/lib/format";
import { isRental } from "@/lib/property";

/**
 * The listing table.
 *
 * Shows what the public search cannot: drafts, and soft-deleted rows when asked for.
 * Mutations call the API directly and then ask the page to refetch — no optimistic
 * updates, matching the lead screens, because a row that claims to be published when
 * it isn't is worse than a moment's wait.
 *
 * Takes: properties (array), onChanged (function — refetch).
 */

/** Commercial status → badge tone. Text always says it too; colour never carries alone. */
const STATUS_TONES = {
  available: "success",
  under_offer: "warning",
  let_agreed: "warning",
  sold: "muted",
  let: "muted",
  withdrawn: "muted",
};

export default function PropertyTable({ properties = [], onChanged }) {
  const { user } = useAdminSession();
  const isAdministrator = user.role === "administrator";

  // The row awaiting delete confirmation, or null.
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);

  /**
   * Runs a row mutation, then refetches.
   *
   * Takes: id (string), action (async function), successMessage (string).
   */
  const run = async (id, action, successMessage) => {
    setBusyId(id);
    try {
      await action();
      toast.success(successMessage);
      await onChanged?.();
    } catch (error) {
      // Shown verbatim: a 403 here is the API's ownership or role rule speaking.
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  /**
   * The headline figure for a row.
   *
   * `price` is truthy even on rentals, so this branches on listingType — checking
   * `property.price` would show a sale price on every let.
   */
  const priceLabel = (property) => {
    if (isRental(property)) {
      const { amount, period, currency } = property.rent ?? {};
      if (amount == null) return "—";
      return `${formatMoney(amount, currency)} ${formatRentPeriod(period)}`;
    }

    if (property.price?.onRequest) return "On request";
    if (property.price?.amount == null) return "—";
    return formatMoney(property.price.amount, property.price.currency);
  };

  if (properties.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted">
        No listings match these filters.
      </p>
    );
  }

  return (
    <>
      {/* Horizontal scroll lives on the table's own wrapper, so the page body never
          scrolls sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-[0.06em] text-muted">
              <th scope="col" className="p-3 font-medium">Listing</th>
              <th scope="col" className="p-3 font-medium">Area</th>
              <th scope="col" className="p-3 font-medium">Type</th>
              <th scope="col" className="p-3 font-medium">Price</th>
              <th scope="col" className="p-3 font-medium">Status</th>
              <th scope="col" className="p-3 font-medium">Visibility</th>
              <th scope="col" className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {properties.map((property) => {
              const deleted = Boolean(property.deletedAt);
              const busy = busyId === property._id;

              return (
                <tr
                  key={property._id}
                  // Deleted rows stay legible but visibly inactive.
                  className={`border-b border-border ${deleted ? "opacity-55" : ""}`}
                >
                  {/* Identity: thumbnail, title link, reference */}
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {property.coverImage?.thumbnailUrl ? (
                        // Plain <img>: an admin table has no LCP or SEO stake, and
                        // next/image would need every Cloudinary host configured.
                        <img
                          src={property.coverImage.thumbnailUrl}
                          alt=""
                          className="h-11 w-14 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded bg-ink/5 text-muted">
                          <FiImage size={16} aria-hidden="true" />
                          <span className="sr-only">No image</span>
                        </span>
                      )}

                      <div className="min-w-0">
                        <Link
                          href={`/admin/properties/${property._id}`}
                          className="block truncate text-ink transition-colors duration-200 hover:text-accent-text"
                        >
                          {property.title}
                        </Link>
                        <span className="text-xs text-muted">
                          {property.reference}
                          {property.isFeatured && " · Featured"}
                          {deleted && " · Deleted"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="p-3 text-ink-soft">{property.location?.name ?? "—"}</td>

                  <td className="p-3 text-ink-soft">
                    {humanise(property.propertyType)}
                    <span className="block text-xs text-muted">
                      {property.listingType === "rent" ? "To let" : "For sale"}
                    </span>
                  </td>

                  <td className="p-3 text-ink">{priceLabel(property)}</td>

                  <td className="p-3">
                    <Badge tone={STATUS_TONES[property.status] ?? "muted"}>
                      {humanise(property.status)}
                    </Badge>
                  </td>

                  <td className="p-3">
                    <Badge
                      tone={property.publicationState === "published" ? "accent" : "muted"}
                    >
                      {humanise(property.publicationState)}
                    </Badge>
                  </td>

                  {/* Row actions */}
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Featuring is an editorial decision about the homepage, so
                          administrators only. The API 403s anyone else regardless. */}
                      {isAdministrator && !deleted && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(
                              property._id,
                              () => featureProperty(property._id, !property.isFeatured),
                              property.isFeatured ? "Removed from homepage" : "Featured",
                            )
                          }
                          aria-pressed={property.isFeatured}
                          title={property.isFeatured ? "Remove from homepage" : "Feature on homepage"}
                          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded transition-colors duration-200 hover:bg-ink/5 disabled:cursor-not-allowed ${
                            property.isFeatured ? "text-accent-text" : "text-muted"
                          }`}
                        >
                          <FiStar size={16} aria-hidden="true" />
                          <span className="sr-only">
                            {property.isFeatured ? "Unfeature" : "Feature"} {property.title}
                          </span>
                        </button>
                      )}

                      {deleted ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(
                              property._id,
                              () => restoreProperty(property._id),
                              "Listing restored",
                            )
                          }
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted transition-colors duration-200 hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed"
                        >
                          <FiRotateCcw size={16} aria-hidden="true" />
                          <span className="sr-only">Restore {property.title}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setPendingDelete(property)}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted transition-colors duration-200 hover:bg-ink/5 hover:text-danger disabled:cursor-not-allowed"
                        >
                          <FiTrash2 size={16} aria-hidden="true" />
                          <span className="sr-only">Delete {property.title}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Deletion on a listing is soft and reversible — unlike a lead, where it is a
          permanent NDPA erasure. The wording has to say which one this is. */}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.reference ?? ""}?`}
        body="The listing is unpublished and hidden from the site. Enquiries and viewings that reference it keep working, and you can restore it from this table."
        confirmLabel="Delete listing"
        loading={busyId === pendingDelete?._id}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const target = pendingDelete;
          await run(target._id, () => deleteProperty(target._id), "Listing deleted");
          setPendingDelete(null);
        }}
      />
    </>
  );
}
