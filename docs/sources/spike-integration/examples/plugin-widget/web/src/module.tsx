import { gql, type TypedDocumentNode } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { contribute, defineWebModule, type SlotProps } from "@northmes/web-sdk";
import "@module-styles";

// The widget's own query, against planning (in its dependsOn). Never another plugin's fields.
const LargeOrders: TypedDocumentNode<{ planningProductionOrders: { edges: { node: { id: string; quantity: number } }[] } }, Record<string, never>> = gql`
  query ExampleWidgetLargeOrders { planningProductionOrders(first: 100) { edges { node { id quantity } } } }
`;

function LargeOrdersWidget({ plantId }: SlotProps["planning/board/side/v1"]) {
  const { data } = useQuery(LargeOrders);
  const large = data?.planningProductionOrders.edges.filter((e) => e.node.quantity > 1000).length;
  return (
    <div data-testid="example-widget" className="xw:rounded-lg xw:border xw:border-border xw:bg-primary xw:p-3 xw:text-primary-foreground">
      {data ? `${large} orders above 1000 pieces at ${plantId}` : "loading"}
    </div>
  );
}

export default defineWebModule({
  id: "example-widget",
  version: "0.1.0",
  northmesRange: ">=0.1.0 <0.2.0",
  permissions: [],
  nav: [],
  contributions: [contribute({ id: "example-widget.large-orders", slot: "planning/board/side/v1", component: LargeOrdersWidget })],
});
