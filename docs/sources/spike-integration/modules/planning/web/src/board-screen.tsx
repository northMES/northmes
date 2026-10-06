import { CombinedGraphQLErrors } from "@apollo/client";
import { useMutation, useQuery, useSubscription } from "@apollo/client/react";
import { useParams } from "@tanstack/react-router";
import { Slot } from "@northmes/web-sdk";
import { useState } from "react";
import { PlanningBoard, PlanningBoardChanged, ReleaseProductionOrder } from "./board.graphql";

export function BoardScreen() {
  const { plant } = useParams({ from: "/$plant/planning/board" });
  const { data } = useQuery(PlanningBoard);
  // Payload carries __typename, id and changed fields; the normalized cache updates the row.
  const { data: lastEvent } = useSubscription(PlanningBoardChanged, { variables: { plantId: plant } });
  const [release] = useMutation(ReleaseProductionOrder);
  const [message, setMessage] = useState<string>("");
  const onRelease = async (id: string) => {
    try {
      await release({ variables: { id } });
      setMessage(`released ${id}`);
    } catch (e) {
      const ext = CombinedGraphQLErrors.is(e) ? e.errors[0]?.extensions : undefined;
      setMessage(`${(ext?.errorCode as string) ?? "error"}: ${CombinedGraphQLErrors.is(e) ? e.errors[0]?.message : String(e)}`);
    }
  };
  return (
    <div className="flex gap-4">
      <div data-testid="board-screen" className="flex-1 rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold">Planning board</h2>
        <table className="w-full text-sm">
          <tbody>
            {data?.planningProductionOrders.edges.map(({ node }) => (
              <tr key={node.id} data-testid={`order-${node.number}`}>
                <td>{node.number}</td>
                <td data-testid={`article-${node.number}`}>{node.article?.name}</td>
                <td>{node.quantity}</td>
                <td data-testid={`status-${node.number}`}>{node.status}</td>
                <td><button type="button" data-testid={`release-${node.number}`} onClick={() => onRelease(node.id)}>Release</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p data-testid="board-message">{message}</p>
        <p data-testid="board-last-event">{lastEvent ? `${lastEvent.planningBoardChanged.kind} ${lastEvent.planningBoardChanged.productionOrder.id}` : "no events"}</p>
      </div>
      <aside data-testid="board-side" className="w-64">
        <Slot id="planning/board/side/v1" props={{ plantId: plant }} />
      </aside>
    </div>
  );
}
