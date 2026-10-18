// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Server-only: REST controllers declare their path and route family with ApiController, and
// toRestRoutes turns a module's operation declarations into its public routes.
export {
  API_CONTROLLER_METADATA,
  ApiController,
  type ApiControllerOptions,
  type ApiFamily,
} from './api-controller.ts';
export {
  PROBLEM_CONTENT_TYPE,
  PROBLEM_TYPE_BASE,
  type Problem,
  problemOf,
  problemType,
} from './problem.ts';
export {
  operationIdOf,
  type ProblemStatus,
  PUBLIC_API_OPERATION_METADATA,
  PublicApiOperation,
  type PublicApiOperationMetadata,
  publicApiOperationsOf,
} from './public-api-operation.ts';
export {
  isBuiltByToRestRoutes,
  type PublicOperationCall,
  PublicOperationRunner,
  publicApiPath,
  toRestRoutes,
} from './to-rest-routes.ts';
