import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("keeps reverse tab navigation inside the dialog from its initial focus", async () => {
    const user = userEvent.setup();
    const view = render(
      <Modal
        title="確認"
        onClose={vi.fn()}
        footer={<button type="button">実行</button>}
      >
        <button type="button">内容の操作</button>
      </Modal>,
    );

    const dialog = view.getByRole("dialog", { name: "確認" });
    expect(dialog).toHaveFocus();

    await user.tab({ shift: true });

    expect(view.getByRole("button", { name: "実行" })).toHaveFocus();
  });

  it("wraps forward tab navigation from the last control to the first control", async () => {
    const user = userEvent.setup();
    const view = render(
      <Modal
        title="確認"
        onClose={vi.fn()}
        footer={<button type="button">実行</button>}
      >
        <button type="button">内容の操作</button>
      </Modal>,
    );

    view.getByRole("button", { name: "実行" }).focus();
    await user.tab();

    expect(view.getByRole("button", { name: "閉じる" })).toHaveFocus();
  });
});
