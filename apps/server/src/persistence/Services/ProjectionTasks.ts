/**
 * ProjectionTaskRepository - Projection repository interface for tasks.
 *
 * Owns persistence operations for task rows in the orchestration projection
 * read model.
 *
 * @module ProjectionTaskRepository
 */
import { IsoDateTime, ProjectId, TaskId } from "@t3tools/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const ProjectionTask = Schema.Struct({
  taskId: TaskId,
  projectId: ProjectId,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  status: Schema.String,
  priority: Schema.String,
  dueDate: Schema.NullOr(IsoDateTime),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  completedAt: Schema.NullOr(IsoDateTime),
  deletedAt: Schema.NullOr(IsoDateTime),
});
export type ProjectionTask = typeof ProjectionTask.Type;

export const GetProjectionTaskInput = Schema.Struct({
  taskId: TaskId,
});
export type GetProjectionTaskInput = typeof GetProjectionTaskInput.Type;

export const ListProjectionTasksByProjectInput = Schema.Struct({
  projectId: ProjectId,
});
export type ListProjectionTasksByProjectInput = typeof ListProjectionTasksByProjectInput.Type;

export const DeleteProjectionTaskInput = Schema.Struct({
  taskId: TaskId,
});
export type DeleteProjectionTaskInput = typeof DeleteProjectionTaskInput.Type;

/**
 * ProjectionTaskRepositoryShape - Service API for projected task records.
 */
export interface ProjectionTaskRepositoryShape {
  /**
   * Insert or replace a projected task row.
   */
  readonly upsert: (row: ProjectionTask) => Effect.Effect<void, ProjectionRepositoryError>;

  /**
   * Read a projected task row by id.
   */
  readonly getById: (
    input: GetProjectionTaskInput,
  ) => Effect.Effect<Option.Option<ProjectionTask>, ProjectionRepositoryError>;

  /**
   * List all projected task rows.
   */
  readonly listAll: () => Effect.Effect<ReadonlyArray<ProjectionTask>, ProjectionRepositoryError>;

  /**
   * List projected task rows by project id.
   */
  readonly listByProjectId: (
    input: ListProjectionTasksByProjectInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionTask>, ProjectionRepositoryError>;

  /**
   * Delete a projected task row by id.
   */
  readonly deleteById: (
    input: DeleteProjectionTaskInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

/**
 * ProjectionTaskRepository - Service tag for task projection persistence.
 */
export class ProjectionTaskRepository extends ServiceMap.Service<
  ProjectionTaskRepository,
  ProjectionTaskRepositoryShape
>()("t3/persistence/Services/ProjectionTasks/ProjectionTaskRepository") {}
