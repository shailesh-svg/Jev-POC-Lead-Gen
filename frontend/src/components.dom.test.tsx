import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";
import { ProfilesTab } from "./ProfilesTab";
import { SettingsTab } from "./SettingsTab";
import { blank, type Profile } from "./profileTypes";

afterEach(cleanup);

const profile = (over: Partial<Profile> = {}): Profile => ({
  ...blank(),
  id: "p1",
  name: "Senior Engineer",
  description: "Builds reliable services.",
  ...over,
});

describe("ProfilesTab", () => {
  it("reports which profile each action was for", async () => {
    const onUse = vi.fn(),
      onDelete = vi.fn(),
      setDraft = vi.fn();
    render(
      <ProfilesTab
        profiles={[profile(), profile({ id: "p2", name: "Designer" })]}
        moreTemplates={[]}
        setDraft={setDraft}
        onUse={onUse}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getAllByText("Use profile")[1]);
    expect(onUse.mock.calls[0][0].id).toBe("p2");
    await userEvent.click(screen.getByLabelText("Delete Designer"));
    expect(onDelete).toHaveBeenCalledWith("p2");
    await userEvent.click(screen.getByLabelText("Edit Senior Engineer"));
    expect(setDraft.mock.calls[0][0].name).toBe("Senior Engineer");
    // The draft carries row keys the API never sees.
    expect(setDraft.mock.calls[0][0].criteria[0]._k).toBeGreaterThan(0);
  });

  it("shows the empty state only when there are no profiles", () => {
    render(
      <ProfilesTab
        profiles={[]}
        moreTemplates={[]}
        setDraft={vi.fn()}
        onUse={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Your first profile starts here.")).toBeDefined();
  });
});

describe("SettingsTab", () => {
  it("submits the typed key and clears the field once it saves", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <SettingsTab
        configured={false}
        envKey={false}
        busy=""
        onSave={onSave}
        onRemove={vi.fn()}
      />,
    );
    const field = screen.getByLabelText("API key") as HTMLInputElement;
    await userEvent.type(field, "sk-test-key");
    await userEvent.click(screen.getByText("Save API key"));
    expect(onSave).toHaveBeenCalledWith("sk-test-key");
    expect(field.value).toBe("");
  });

  it("keeps the key in the field when saving fails", async () => {
    render(
      <SettingsTab
        configured={false}
        envKey={false}
        busy=""
        onSave={vi.fn().mockResolvedValue(false)}
        onRemove={vi.fn()}
      />,
    );
    const field = screen.getByLabelText("API key") as HTMLInputElement;
    await userEvent.type(field, "sk-bad-key");
    await userEvent.click(screen.getByText("Save API key"));
    expect(field.value).toBe("sk-bad-key");
  });

  it("offers to remove the saved key only once one is configured", async () => {
    const onRemove = vi.fn();
    const { rerender } = render(
      <SettingsTab
        configured={false}
        envKey={false}
        busy=""
        onSave={vi.fn()}
        onRemove={onRemove}
      />,
    );
    expect(screen.queryByText("Remove saved key")).toBeNull();
    rerender(
      <SettingsTab
        configured
        envKey={false}
        busy=""
        onSave={vi.fn()}
        onRemove={onRemove}
      />,
    );
    await userEvent.click(screen.getByText("Remove saved key"));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("Modal", () => {
  it("closes on a backdrop click but not on a click inside", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal labelledBy="t" locked={false} onClose={onClose}>
        <h2 id="t">Delete this profile?</h2>
      </Modal>,
    );
    await userEvent.click(screen.getByText("Delete this profile?"));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(container.querySelector(".modal-backdrop")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores the backdrop while a request is in flight", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal labelledBy="t" locked onClose={onClose}>
        <h2 id="t">Saving…</h2>
      </Modal>,
    );
    await userEvent.click(container.querySelector(".modal-backdrop")!);
    expect(onClose).not.toHaveBeenCalled();
  });
});
