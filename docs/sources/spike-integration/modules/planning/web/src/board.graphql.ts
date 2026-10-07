import { gql, type TypedDocumentNode } from "@apollo/client";

// Hand-written stand-ins for codegen output from schema/api.graphql.
export interface BoardOrder { __typename: "ProductionOrder"; id: string; number: string; quantity: number; status: string; version: number; article: { __typename: "Article"; id: string; name: string } | null }

export const PlanningBoard: TypedDocumentNode<{ planningProductionOrders: { edges: { node: BoardOrder }[] } }, Record<string, never>> = gql`
  query PlanningBoard {
    planningProductionOrders(first: 50) { edges { node { id number quantity status version article { id name } } } }
  }
`;

export const PlanningBoardChanged: TypedDocumentNode<{ planningBoardChanged: { kind: string; productionOrder: Pick<BoardOrder, "__typename" | "id" | "status" | "version"> } }, { plantId: string }> = gql`
  subscription PlanningBoardChanged($plantId: ID!) {
    planningBoardChanged(plantId: $plantId) { kind productionOrder { id status version } }
  }
`;

export const ReleaseProductionOrder: TypedDocumentNode<{ planningReleaseProductionOrder: Pick<BoardOrder, "__typename" | "id" | "status" | "version"> }, { id: string }> = gql`
  mutation ReleaseProductionOrder($id: ID!) {
    planningReleaseProductionOrder(id: $id) { id status version }
  }
`;
