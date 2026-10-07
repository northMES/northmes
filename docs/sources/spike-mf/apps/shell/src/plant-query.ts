import { gql, type TypedDocumentNode } from "@apollo/client";

export const ShellPlantQuery: TypedDocumentNode<
  { plant: { __typename: "Plant"; id: string; name: string } },
  { id: string }
> = gql`
  query ShellPlant($id: ID!) {
    plant(id: $id) {
      id
      name
    }
  }
`;
