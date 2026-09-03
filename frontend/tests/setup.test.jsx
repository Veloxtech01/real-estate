import { render, screen } from "@testing-library/react";

/**
 * Verifies the test harness itself — JSX transform, jsdom environment, Testing
 * Library, and the jest-dom matchers from vitest.setup.js.
 *
 * Deliberately renders a trivial inline component rather than a real page, so this
 * test stays valid as the app's actual pages come and go.
 */
describe("test harness", () => {
  it("renders a component into jsdom and applies jest-dom matchers", () => {
    // globals: true in vitest.config.js is what makes describe/it/expect available
    // without imports — if that config were dropped, this file would fail to run.
    render(<h1>Test harness online</h1>);

    expect(
      screen.getByRole("heading", { name: /test harness online/i })
    ).toBeInTheDocument();
  });
});
