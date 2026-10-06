import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useParams } from "@tanstack/react-router";
import { Button, TopBarActions } from "@northmes/ui";
import { useShell } from "@northmes/web-sdk";
import { useState } from "react";
import { PlantQuery, RenamePlant } from "./plant-query";

declare global {
  interface Window {
    __planningClient?: unknown;
  }
}

export function BoardScreen() {
  const shell = useShell();
  const { plant } = useParams({ from: "/$plant/planning/board" });
  const client = useApolloClient();
  window.__planningClient = client;
  const { data } = useQuery(PlantQuery, { variables: { id: plant } });
  const [rename] = useMutation(RenamePlant);
  const [count, setCount] = useState(0);
  return (
    <div data-testid="board-screen" className="rounded-lg border border-border bg-muted p-4">
      <h2 className="text-lg font-semibold">Planning board</h2>
      <TopBarActions>
        <Button data-testid="board-top-action">Autoplan</Button>
      </TopBarActions>
      <p data-testid="board-user">Signed in as {shell.userName}</p>
      <p data-testid="board-plant-name">Plant: {data?.plant.name ?? "loading"}</p>
      <span className="hidden">only here so the remote stylesheet contains .hidden</span>
      <p data-testid="hmr-marker">board v1</p>
      <button type="button" data-testid="counter" onClick={() => setCount((c) => c + 1)}>count {count}</button>
      <Button
        data-testid="rename-plant"
        onClick={() => rename({ variables: { id: plant, name: `Renamed by planning ${Date.now() % 1000}` } })}
      >
        Rename plant from the remote
      </Button>
    </div>
  );
}
