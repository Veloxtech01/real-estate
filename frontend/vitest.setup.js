// Vitest setup — runs once before every test file.

// Adds DOM matchers (toBeInTheDocument, toHaveAttribute, ...) to expect().
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount anything rendered between tests. Without this, components persist in the
// shared jsdom document and queries like getByRole start matching leftovers from a
// previous test.
afterEach(() => {
  cleanup();
});
