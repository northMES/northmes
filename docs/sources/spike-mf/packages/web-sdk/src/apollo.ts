import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export interface CreateNorthmesClientOptions {
  readonly uri?: string;
}

/** The one Apollo client of the page. Only the shell calls this. */
export function createNorthmesClient(options: CreateNorthmesClientOptions = {}): ApolloClient {
  return new ApolloClient({
    link: new HttpLink({ uri: options.uri ?? "/graphql", credentials: "same-origin" }),
    cache: new InMemoryCache(),
  });
}
