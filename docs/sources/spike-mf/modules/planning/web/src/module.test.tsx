import { MockedProvider } from "@apollo/client/testing/react";
import { ShellProvider, validateWebModule } from "@northmes/web-sdk";
import { createShellRoutes } from "@northmes/web-sdk/routes";
import { createMemoryHistory, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import webModule from "./module";
import { PlantQuery } from "./plant-query";

function renderAt(path: string) {
  const { rootRoute, plantRoute } = createShellRoutes({
    root: () => <Outlet />,
    plant: () => (
      <ShellProvider value={{ plantId: "plant-a", userName: "Test User", permissions: new Set() }}>
        <Outlet />
      </ShellProvider>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([plantRoute.addChildren([webModule.routes(plantRoute)])]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const mocks = [
    {
      request: { query: PlantQuery, variables: { id: "plant-a" } },
      result: { data: { plant: { __typename: "Plant", id: "plant-a", name: "Mocked plant" } } },
    },
  ];
  return render(
    <MockedProvider mocks={mocks}>
      <RouterProvider router={router} />
    </MockedProvider>,
  );
}

describe("planning web module", () => {
  it("satisfies the module contract", () => {
    expect(validateWebModule(webModule, "planning")).toEqual([]);
    expect(webModule.nav.map((n) => n.to)).toContain("planning/board");
  });

  it("renders the board under /$plant with shell context and GraphQL data", async () => {
    renderAt("/plant-a/planning/board");
    expect(await screen.findByText("Signed in as Test User")).toBeTruthy();
    expect(await screen.findByText("Plant: Mocked plant")).toBeTruthy();
  });

  it("renders an order from its URL", async () => {
    renderAt("/plant-a/planning/orders/4101");
    expect(await screen.findByText("Production order 4101")).toBeTruthy();
  });
});
