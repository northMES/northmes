// SPDX-License-Identifier: MIT
// Server-only: the binding of a module's operation declarations to its service, and the operation
// runner that every surface calls (ADR 0073).
export type {
  Operation,
  OperationEntry,
  OperationScope,
  OperationsDeclaration,
} from '@northmes/contracts';
export {
  type BoundOperations,
  type BoundOperationsProvider,
  bindOperations,
  isBoundOperationsProvider,
  type OperationContext,
  type OperationHandler,
  type OperationHandlers,
} from './bind-operations.ts';
export { noteCreated } from './outcome.ts';
export {
  type OperationCall,
  type OperationError,
  type OperationPorts,
  type OperationResult,
  operationError,
  type RunnableOperation,
  runOperation,
  type Surface,
} from './runner.ts';
export {
  OUTSIDE_TEXT_MAX_LENGTH,
  OUTSIDE_TEXT_MAX_VALUES,
  type UntrustedText,
  wrapOutsideText,
} from './tool-output.ts';
