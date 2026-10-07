import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { OperationTypeNode } from "graphql";
import { createClient } from "graphql-ws";

export interface CreateNorthmesClientOptions {
  readonly uri?: string;
  /** The plant in the URL, sent with every operation so two tabs can work on two plants. */
  readonly plant: () => string;
}

/** The one Apollo client of the page. Only the shell calls this. Same origin: cookie on HTTP and on the WS upgrade. */
export function createNorthmesClient(options: CreateNorthmesClientOptions): ApolloClient {
  const uri = options.uri ?? "/graphql";
  const plantHeader = new ApolloLink((operation, forward) => {
    operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({ headers: { ...headers, "x-northmes-plant": options.plant() } }));
    return forward(operation);
  });
  const ws = new GraphQLWsLink(
    createClient({
      url: () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${uri}`,
      connectionParams: () => ({ plantId: options.plant() }),
    }),
  );
  const http = ApolloLink.from([plantHeader, new HttpLink({ uri, credentials: "same-origin" })]);
  return new ApolloClient({
    link: ApolloLink.split((op) => op.operationType === OperationTypeNode.SUBSCRIPTION, ws, http),
    cache: new InMemoryCache(),
  });
}
