// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DrawerRouteLink, DrawerRouteProvider } from "../../apps/web/src/components/ui/FormDrawer";

function CurrentPath() {
  const { pathname } = useLocation();
  return <output aria-label="Current path">{pathname}</output>;
}

describe("DrawerRouteLink", () => {
  it("opens a drawer without navigating away from the current page", () => {
    const openDrawer = vi.fn();

    render(
      <MemoryRouter initialEntries={["/applications"]}>
        <DrawerRouteProvider value={{ open: openDrawer, close: vi.fn(), isLocal: false }}>
          <DrawerRouteLink to="/applications/new">Add application</DrawerRouteLink>
          <CurrentPath />
        </DrawerRouteProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Add application" }));

    expect(openDrawer).toHaveBeenCalledWith("/applications/new");
    expect(screen.getByLabelText("Current path")).toHaveTextContent("/applications");
  });
});
