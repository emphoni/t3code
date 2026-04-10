import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Option, Schema } from "effect";

import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";

import {
  DeleteProjectionTaskInput,
  GetProjectionTaskInput,
  ListProjectionTasksByProjectInput,
  ProjectionTask,
  ProjectionTaskRepository,
  type ProjectionTaskRepositoryShape,
} from "../Services/ProjectionTasks.ts";

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown) =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

const makeProjectionTaskRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertProjectionTaskRow = SqlSchema.void({
    Request: ProjectionTask,
    execute: (row) =>
      sql`
        INSERT INTO projection_tasks (
          task_id,
          project_id,
          title,
          description,
          status,
          priority,
          due_date,
          created_at,
          updated_at,
          completed_at,
          deleted_at
        )
        VALUES (
          ${row.taskId},
          ${row.projectId},
          ${row.title},
          ${row.description},
          ${row.status},
          ${row.priority},
          ${row.dueDate},
          ${row.createdAt},
          ${row.updatedAt},
          ${row.completedAt},
          ${row.deletedAt}
        )
        ON CONFLICT (task_id)
        DO UPDATE SET
          project_id = excluded.project_id,
          title = excluded.title,
          description = excluded.description,
          status = excluded.status,
          priority = excluded.priority,
          due_date = excluded.due_date,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          completed_at = excluded.completed_at,
          deleted_at = excluded.deleted_at
      `,
  });

  const getProjectionTaskRow = SqlSchema.findOneOption({
    Request: GetProjectionTaskInput,
    Result: ProjectionTask,
    execute: ({ taskId }) =>
      sql`
        SELECT
          task_id AS "taskId",
          project_id AS "projectId",
          title,
          description,
          status,
          priority,
          due_date AS "dueDate",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          completed_at AS "completedAt",
          deleted_at AS "deletedAt"
        FROM projection_tasks
        WHERE task_id = ${taskId}
      `,
  });

  const listProjectionTaskRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionTask,
    execute: () =>
      sql`
        SELECT
          task_id AS "taskId",
          project_id AS "projectId",
          title,
          description,
          status,
          priority,
          due_date AS "dueDate",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          completed_at AS "completedAt",
          deleted_at AS "deletedAt"
        FROM projection_tasks
        ORDER BY created_at ASC, task_id ASC
      `,
  });

  const listProjectionTaskRowsByProjectId = SqlSchema.findAll({
    Request: ListProjectionTasksByProjectInput,
    Result: ProjectionTask,
    execute: ({ projectId }) =>
      sql`
        SELECT
          task_id AS "taskId",
          project_id AS "projectId",
          title,
          description,
          status,
          priority,
          due_date AS "dueDate",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          completed_at AS "completedAt",
          deleted_at AS "deletedAt"
        FROM projection_tasks
        WHERE project_id = ${projectId}
        ORDER BY created_at ASC, task_id ASC
      `,
  });

  const deleteProjectionTaskRow = SqlSchema.void({
    Request: DeleteProjectionTaskInput,
    execute: ({ taskId }) =>
      sql`
        DELETE FROM projection_tasks
        WHERE task_id = ${taskId}
      `,
  });

  const upsert: ProjectionTaskRepositoryShape["upsert"] = (row) =>
    upsertProjectionTaskRow(row).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "ProjectionTaskRepository.upsert:query",
          "ProjectionTaskRepository.upsert:encodeRequest",
        ),
      ),
    );

  const getById: ProjectionTaskRepositoryShape["getById"] = (input) =>
    getProjectionTaskRow(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "ProjectionTaskRepository.getById:query",
          "ProjectionTaskRepository.getById:decodeRow",
        ),
      ),
      Effect.flatMap((rowOption) =>
        Option.match(rowOption, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (row) =>
            Effect.succeed(Option.some(row as Schema.Schema.Type<typeof ProjectionTask>)),
        }),
      ),
    );

  const listAll: ProjectionTaskRepositoryShape["listAll"] = () =>
    listProjectionTaskRows().pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "ProjectionTaskRepository.listAll:query",
          "ProjectionTaskRepository.listAll:decodeRows",
        ),
      ),
      Effect.map((rows) => rows as ReadonlyArray<Schema.Schema.Type<typeof ProjectionTask>>),
    );

  const listByProjectId: ProjectionTaskRepositoryShape["listByProjectId"] = (input) =>
    listProjectionTaskRowsByProjectId(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "ProjectionTaskRepository.listByProjectId:query",
          "ProjectionTaskRepository.listByProjectId:decodeRows",
        ),
      ),
      Effect.map((rows) => rows as ReadonlyArray<Schema.Schema.Type<typeof ProjectionTask>>),
    );

  const deleteById: ProjectionTaskRepositoryShape["deleteById"] = (input) =>
    deleteProjectionTaskRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionTaskRepository.deleteById:query")),
    );

  return {
    upsert,
    getById,
    listAll,
    listByProjectId,
    deleteById,
  } satisfies ProjectionTaskRepositoryShape;
});

export const ProjectionTaskRepositoryLive = Layer.effect(
  ProjectionTaskRepository,
  makeProjectionTaskRepository,
);
