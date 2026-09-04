"use client";

import { FiArrowLeft } from "react-icons/fi";

/**
 * The two-column shell shared by the inbox and the diary.
 *
 * Desktop shows both columns; below lg only one is visible at a time, because a
 * side-by-side master-detail on a phone gives neither half enough room. Which one
 * shows is driven by `hasSelection`, which the parent derives from the URL — so the
 * layout has no state of its own.
 *
 * @param {ReactNode} list Left column.
 * @param {ReactNode} detail Right column; rendered only when hasSelection.
 * @param {boolean} hasSelection Whether a row is currently selected.
 * @param {() => void} onClearSelection Back action for the mobile detail view.
 */
export default function MasterDetail({ list, detail, hasSelection, onClearSelection }) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* List column — hidden on mobile while a row is selected. */}
      <div
        className={`w-full overflow-y-auto border-r border-border lg:block lg:w-96 lg:shrink-0 ${
          hasSelection ? "hidden" : "block"
        }`}
      >
        {list}
      </div>

      {/* Detail column */}
      <div className={`w-full overflow-y-auto lg:block ${hasSelection ? "block" : "hidden"}`}>
        {hasSelection ? (
          <>
            {/* Mobile-only escape back to the list. */}
            <button
              type="button"
              onClick={onClearSelection}
              className="flex min-h-11 cursor-pointer items-center gap-2 px-5 pt-4 text-sm text-ink-soft transition-colors duration-200 hover:text-accent-text lg:hidden"
            >
              <FiArrowLeft size={16} aria-hidden="true" />
              Back to list
            </button>
            {detail}
          </>
        ) : (
          // Desktop resting state. Without this the right half looks broken on load.
          <div className="hidden h-full items-center justify-center p-10 lg:flex">
            <p className="text-sm text-muted">Select a row to see its details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
