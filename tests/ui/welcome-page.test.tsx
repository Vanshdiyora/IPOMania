// @vitest-environment jsdom

import axe from "axe-core";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomePage } from "../../apps/web/src/pages/WelcomePage";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock("../../apps/web/src/auth/useAuth", () => ({ useAuth: useAuthMock }));

describe("WelcomePage accessibility and untrusted text", () => {
  beforeEach(() => useAuthMock.mockReturnValue({ user: null }));

  it("supports keyboard navigation and passes axe WCAG 2.2 AA checks", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    );

    await user.tab();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveFocus();

    const results = await axe.run(container, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    expect(results.violations).toEqual([]);
  });

  it("renders user-provided text as text rather than executable markup", () => {
    useAuthMock.mockReturnValue({ user: { email: '<img src=x onerror="alert(1)">' } });
    const { container } = render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });
});
