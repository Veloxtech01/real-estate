import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MediaManager from "./MediaManager";
import * as admin from "@/lib/api/admin";

/**
 * The listing gallery.
 *
 * The behaviours worth pinning are the ones a wrong guess makes destructive or
 * confusing: deleting without confirmation, offering upload on a listing that has no
 * id yet, and reordering with a mouse only.
 */

const media = [
  {
    _id: "m1",
    url: "https://res.cloudinary.com/x/a.jpg",
    thumbnailUrl: "https://res.cloudinary.com/x/a-thumb.jpg",
    alt: "Front elevation",
    displayOrder: 0,
  },
  {
    _id: "m2",
    url: "https://res.cloudinary.com/x/b.jpg",
    thumbnailUrl: "https://res.cloudinary.com/x/b-thumb.jpg",
    alt: "Living room",
    displayOrder: 1,
  },
];

beforeEach(() => {
  vi.spyOn(admin, "reorderMedia").mockResolvedValue(media);
  vi.spyOn(admin, "deleteMedia").mockResolvedValue(undefined);
  vi.spyOn(admin, "updateMedia").mockResolvedValue(media[0]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MediaManager", () => {
  it("tells the user to save first when there is no listing yet", () => {
    render(<MediaManager propertyId={null} media={[]} value="" onChange={() => {}} />);

    // Uploading before the listing exists means no folder and no ownership check,
    // so the assets would be orphaned by an abandoned draft.
    expect(screen.getByText(/save the listing first/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/add photos/i)).not.toBeInTheDocument();
  });

  it("offers a drop zone once the listing exists", () => {
    render(<MediaManager propertyId="p1" media={[]} value="" onChange={() => {}} />);

    expect(screen.getByLabelText(/add photos/i)).toBeInTheDocument();
  });

  it("renders every image with its alt text", () => {
    render(<MediaManager propertyId="p1" media={media} value="" onChange={() => {}} />);

    expect(screen.getByDisplayValue("Front elevation")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Living room")).toBeInTheDocument();
  });

  it("marks the chosen cover and reports a change", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MediaManager propertyId="p1" media={media} value="m1" onChange={onChange} />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeChecked();

    await user.click(radios[1]);
    expect(onChange).toHaveBeenCalledWith("m2");
  });

  it("clears the cover when the current one is clicked again", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MediaManager propertyId="p1" media={media} value="m1" onChange={onChange} />,
    );

    await user.click(screen.getAllByRole("radio")[0]);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("reorders from the keyboard, not just by dragging", async () => {
    const user = userEvent.setup();
    render(<MediaManager propertyId="p1" media={media} value="" onChange={() => {}} />);

    // Drag-and-drop alone would make gallery order unreachable for anyone not using
    // a mouse.
    await user.click(screen.getByRole("button", { name: /move image 1 later/i }));

    await waitFor(() =>
      expect(admin.reorderMedia).toHaveBeenCalledWith("p1", ["m2", "m1"]),
    );
  });

  it("confirms before deleting", async () => {
    const user = userEvent.setup();
    render(<MediaManager propertyId="p1" media={media} value="" onChange={() => {}} />);

    await user.click(screen.getByRole("button", { name: /remove image 1/i }));

    // Deleting an image destroys the Cloudinary asset — it is not undoable the way
    // a soft-deleted listing is.
    expect(admin.deleteMedia).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove permanently/i }));

    await waitFor(() => expect(admin.deleteMedia).toHaveBeenCalledWith("p1", "m1"));
  });

  it("saves alt text on blur", async () => {
    const user = userEvent.setup();
    render(<MediaManager propertyId="p1" media={media} value="" onChange={() => {}} />);

    const input = screen.getByDisplayValue("Front elevation");
    await user.clear(input);
    await user.type(input, "Front of the house");
    await user.tab();

    await waitFor(() =>
      expect(admin.updateMedia).toHaveBeenCalledWith("p1", "m1", {
        alt: "Front of the house",
      }),
    );
  });

  it("does not call the API when alt text is unchanged", async () => {
    const user = userEvent.setup();
    render(<MediaManager propertyId="p1" media={media} value="" onChange={() => {}} />);

    await user.click(screen.getByDisplayValue("Front elevation"));
    await user.tab();

    expect(admin.updateMedia).not.toHaveBeenCalled();
  });

  it("surfaces a failed mutation instead of silently reverting", async () => {
    admin.deleteMedia.mockRejectedValue(new Error("Could not delete the image"));
    const user = userEvent.setup();

    render(<MediaManager propertyId="p1" media={media} value="" onChange={() => {}} />);

    await user.click(screen.getByRole("button", { name: /remove image 1/i }));
    await user.click(screen.getByRole("button", { name: /remove permanently/i }));

    expect(await screen.findByText(/could not delete the image/i)).toBeInTheDocument();
  });
});
