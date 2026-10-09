// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CorePermissionCatalogDocument as CorePermissionCatalog,
  type CorePermissionCatalogQuery,
  type CorePermissionCatalogQueryVariables,
} from './permission-catalog.graphql.gen.ts';

// Every permission of the catalog by module and resource: the role editor ticks them, the role
// page lists those a role includes, and the role picker locks only on installed ones. Company
// settings name the company; a plant page names none. pnpm gen writes its typed document to
// permission-catalog.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    query CorePermissionCatalog($companyId: ID) {
      corePermissionCatalog(companyId: $companyId) {
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
