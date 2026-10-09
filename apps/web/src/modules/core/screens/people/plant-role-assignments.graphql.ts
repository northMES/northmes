// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';
import type { CorePlantRoleAssignmentsQuery } from './plant-role-assignments.graphql.gen.ts';

export {
  CorePlantRoleAssignmentsDocument as CorePlantRoleAssignments,
  type CorePlantRoleAssignmentsQuery,
  type CorePlantRoleAssignmentsQueryVariables,
} from './plant-role-assignments.graphql.gen.ts';

/** A role someone holds at the plant, as People lists it. */
export type PlantAssignment = CorePlantRoleAssignmentsQuery['corePlantRoleAssignments'][number];

// Every role assignment at the plant in the URL, by the holder's name: People in plant settings
// lists them, and its Add role locks the roles a person holds there. A role the reader may not read
// comes as null. pnpm gen writes its typed document to plant-role-assignments.graphql.gen.ts; this
// block never runs.
if (false) {
  gql`
    query CorePlantRoleAssignments {
      corePlantRoleAssignments {
        id
        scope {
          id
          kind
          name
        }
        user {
          id
          name
          username
        }
        role {
          id
          name
          permissions
        }
      }
    }
  `;
}
