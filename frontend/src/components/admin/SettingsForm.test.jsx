import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsForm from "./SettingsForm";

const updateAdminSettings = vi.fn();
vi.mock("@/lib/api/admin", () => ({
  updateAdminSettings: (...args) => updateAdminSettings(...args),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const baseSettings = {
  agencyName: "Velox Realty",
  tagline: "",
  lasreraNumber: "",
  registrationNumbers: [],
  email: "info@example.com",
  phone: "",
  whatsapp: "",
  address: "",
  footerText: "",
  officeHours: [],
  socialLinks: {},
  theme: {
    colors: { accent: "#c6a15b" },
    fontHeading: "",
    fontBody: "",
    logoUrl: "",
    logoDarkUrl: "",
    faviconUrl: "",
  },
  aiSearch: { enabled: false, monthlySpendCapUsd: 50, timeoutMs: 2000, currentSpendUsd: 3.2 },
  listingDisclaimer: "",
  ndpcRegistrationNumber: "",
  googleAnalyticsId: "",
  googleSearchConsoleId: "",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsForm", () => {
  it("renders every section from the loaded settings", () => {
    render(<SettingsForm settings={baseSettings} />);

    expect(screen.getByRole("heading", { name: /agency identity/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /contact/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /branding/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ai search controls/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /compliance/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Velox Realty")).toBeInTheDocument();
  });

  it("shows the read-only spend line, never as an editable field", () => {
    render(<SettingsForm settings={baseSettings} />);

    expect(screen.getByText(/\$3\.20 spent this month, of a \$50\.00 cap/i)).toBeInTheDocument();
  });

  it("saves an edited field and calls onSaved", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    updateAdminSettings.mockResolvedValue({ ...baseSettings, tagline: "Lagos's finest" });
    render(<SettingsForm settings={baseSettings} onSaved={onSaved} />);

    await user.type(screen.getByLabelText(/tagline/i), "Lagos's finest");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(updateAdminSettings).toHaveBeenCalledTimes(1));
    expect(updateAdminSettings.mock.calls[0][0]).toMatchObject({
      agencyName: "Velox Realty",
      tagline: "Lagos's finest",
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("never submits currentSpendUsd", async () => {
    const user = userEvent.setup();
    updateAdminSettings.mockResolvedValue(baseSettings);
    render(<SettingsForm settings={baseSettings} />);

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(updateAdminSettings).toHaveBeenCalledTimes(1));
    expect(updateAdminSettings.mock.calls[0][0].aiSearch).not.toHaveProperty("currentSpendUsd");
  });

  it("disables a day's time inputs once it is marked closed", async () => {
    const user = userEvent.setup();
    render(<SettingsForm settings={baseSettings} />);

    const mondayClosed = screen.getAllByRole("checkbox", { name: /closed/i })[0];
    const mondayInputs = document.querySelectorAll('input[name="officeHours.monday.opensAt"]');
    expect(mondayInputs[0]).not.toBeDisabled();

    await user.click(mondayClosed);

    expect(mondayInputs[0]).toBeDisabled();
  });

  it("maps a dotted-path server error onto its color input", async () => {
    const user = userEvent.setup();
    const failure = new Error("Invalid settings");
    failure.details = { "theme.colors.accent": "Enter a valid hex color" };
    updateAdminSettings.mockRejectedValue(failure);
    render(<SettingsForm settings={baseSettings} />);

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/enter a valid hex color/i)).toBeInTheDocument();
  });

  it("shows an unmatched server error as a form-level banner", async () => {
    const user = userEvent.setup();
    const failure = new Error("Invalid settings");
    failure.details = { "some.unregistered.path": "Something the form has no field for" };
    updateAdminSettings.mockRejectedValue(failure);
    render(<SettingsForm settings={baseSettings} />);

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/something the form has no field for/i)).toBeInTheDocument();
  });
});
