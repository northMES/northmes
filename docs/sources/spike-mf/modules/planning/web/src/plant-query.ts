import { gql, type TypedDocumentNode } from "@apollo/client";

export interface PlantQueryData {
  plant: { __typename: "Plant"; id: string; name: string };
}

export const PlantQuery: TypedDocumentNode<PlantQueryData, { id: string }> = gql`
  query Plant($id: ID!) {
    plant(id: $id) {
      id
      name
    }
  }
`;

export const RenamePlant: TypedDocumentNode<{ renamePlant: PlantQueryData["plant"] }, { id: string; name: string }> = gql`
  mutation RenamePlant($id: ID!, $name: String!) {
    renamePlant(id: $id, name: $name) {
      id
      name
    }
  }
`;
