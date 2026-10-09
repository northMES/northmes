// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CorePermissionCatalogDocument as CorePermissionCatalog,
  type CorePermissionCatalogQuery,
  type CorePermissionCatalogQueryVariables,
} from './permission-catalog.graphql.gen.ts';

// Every permission of the catalog by module and resource: the role editor ticks them, and the role page lists those a role includes. pnpm gen writes its typed document to permission-catalog.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CorePermissionCatalog {
      corePermissionCatalog {
        moduleId
        resources {
          resource
          permissions {
            key
            installed
          }
        }
      }
    }
  `;
}
