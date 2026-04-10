import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Schema, Struct } from "effect";

import { ModelSelection, ProjectScript } from "@t3tools/contracts";
import { toPersistenceSqlError } from "../Errors.ts";
import {
  DeleteProjectionProjectInput,
  GetProjectionProjectInput,
  ProjectionProject,
  ProjectionProjectRepository,
  type ProjectionProjectRepositoryShape,
} from "../Services/ProjectionProjects.ts";

const ProjectionProjectDbRow = ProjectionProject.mapFields(
  Struct.assign({
    defaultModelSelection: Schema.NullOr(Schema.fromJsonString(ModelSelection)),
    scripts: Schema.fromJsonString(Schema.Array(ProjectScript)),
  }),
);
type ProjectionProjectDbRow = typeof ProjectionProjectDbRow.Type;

const makeProjectionProjectRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const projectColumns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_projects)
  `;
  const hasDefaultModelSelectionColumn = projectColumns.some(
    (column) => column.name === "default_model_selection_json",
  );
  const hasLegacyDefaultModelColumn = projectColumns.some((column) => column.name === "default_model");

  const upsertProjectionProjectRow = SqlSchema.void({
    Request: ProjectionProject,
    execute: (row) =>
      hasDefaultModelSelectionColumn
        ? hasLegacyDefaultModelColumn
          ? sql`
              INSERT INTO projection_projects (
                project_id,
                title,
                workspace_root,
                default_model_selection_json,
                default_model,
                scripts_json,
                created_at,
                updated_at,
                deleted_at
              )
              VALUES (
                ${row.projectId},
                ${row.title},
                ${row.workspaceRoot},
                ${row.defaultModelSelection !== null ? JSON.stringify(row.defaultModelSelection) : null},
                ${row.defaultModelSelection?.model ?? null},
                ${JSON.stringify(row.scripts)},
                ${row.createdAt},
                ${row.updatedAt},
                ${row.deletedAt}
              )
              ON CONFLICT (project_id)
              DO UPDATE SET
                title = excluded.title,
                workspace_root = excluded.workspace_root,
                default_model_selection_json = excluded.default_model_selection_json,
                default_model = excluded.default_model,
                scripts_json = excluded.scripts_json,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at,
                deleted_at = excluded.deleted_at
            `
          : sql`
              INSERT INTO projection_projects (
                project_id,
                title,
                workspace_root,
                default_model_selection_json,
                scripts_json,
                created_at,
                updated_at,
                deleted_at
              )
              VALUES (
                ${row.projectId},
                ${row.title},
                ${row.workspaceRoot},
                ${row.defaultModelSelection !== null ? JSON.stringify(row.defaultModelSelection) : null},
                ${JSON.stringify(row.scripts)},
                ${row.createdAt},
                ${row.updatedAt},
                ${row.deletedAt}
              )
              ON CONFLICT (project_id)
              DO UPDATE SET
                title = excluded.title,
                workspace_root = excluded.workspace_root,
                default_model_selection_json = excluded.default_model_selection_json,
                scripts_json = excluded.scripts_json,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at,
                deleted_at = excluded.deleted_at
            `
        : sql`
            INSERT INTO projection_projects (
              project_id,
              title,
              workspace_root,
              default_model,
              scripts_json,
              created_at,
              updated_at,
              deleted_at
            )
            VALUES (
              ${row.projectId},
              ${row.title},
              ${row.workspaceRoot},
              ${row.defaultModelSelection?.model ?? null},
              ${JSON.stringify(row.scripts)},
              ${row.createdAt},
              ${row.updatedAt},
              ${row.deletedAt}
            )
            ON CONFLICT (project_id)
            DO UPDATE SET
              title = excluded.title,
              workspace_root = excluded.workspace_root,
              default_model = excluded.default_model,
              scripts_json = excluded.scripts_json,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at
          `,
  });

  const getProjectionProjectRow = SqlSchema.findOneOption({
    Request: GetProjectionProjectInput,
    Result: ProjectionProjectDbRow,
    execute: ({ projectId }) =>
      hasDefaultModelSelectionColumn
        ? sql`
            SELECT
              project_id AS "projectId",
              title,
              workspace_root AS "workspaceRoot",
              default_model_selection_json AS "defaultModelSelection",
              scripts_json AS "scripts",
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              deleted_at AS "deletedAt"
            FROM projection_projects
            WHERE project_id = ${projectId}
          `
        : sql`
            SELECT
              project_id AS "projectId",
              title,
              workspace_root AS "workspaceRoot",
              CASE
                WHEN default_model IS NULL THEN NULL
                ELSE json_object(
                  'provider',
                  CASE
                    WHEN lower(default_model) LIKE '%claude%' THEN 'claudeAgent'
                    ELSE 'codex'
                  END,
                  'model',
                  default_model
                )
              END AS "defaultModelSelection",
              scripts_json AS "scripts",
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              deleted_at AS "deletedAt"
            FROM projection_projects
            WHERE project_id = ${projectId}
          `,
  });

  const listProjectionProjectRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionProjectDbRow,
    execute: () =>
      hasDefaultModelSelectionColumn
        ? sql`
            SELECT
              project_id AS "projectId",
              title,
              workspace_root AS "workspaceRoot",
              default_model_selection_json AS "defaultModelSelection",
              scripts_json AS "scripts",
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              deleted_at AS "deletedAt"
            FROM projection_projects
            ORDER BY created_at ASC, project_id ASC
          `
        : sql`
            SELECT
              project_id AS "projectId",
              title,
              workspace_root AS "workspaceRoot",
              CASE
                WHEN default_model IS NULL THEN NULL
                ELSE json_object(
                  'provider',
                  CASE
                    WHEN lower(default_model) LIKE '%claude%' THEN 'claudeAgent'
                    ELSE 'codex'
                  END,
                  'model',
                  default_model
                )
              END AS "defaultModelSelection",
              scripts_json AS "scripts",
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              deleted_at AS "deletedAt"
            FROM projection_projects
            ORDER BY created_at ASC, project_id ASC
          `,
  });

  const deleteProjectionProjectRow = SqlSchema.void({
    Request: DeleteProjectionProjectInput,
    execute: ({ projectId }) =>
      sql`
        DELETE FROM projection_projects
        WHERE project_id = ${projectId}
      `,
  });

  const upsert: ProjectionProjectRepositoryShape["upsert"] = (row) =>
    upsertProjectionProjectRow(row).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionProjectRepository.upsert:query")),
    );

  const getById: ProjectionProjectRepositoryShape["getById"] = (input) =>
    getProjectionProjectRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionProjectRepository.getById:query")),
    );

  const listAll: ProjectionProjectRepositoryShape["listAll"] = () =>
    listProjectionProjectRows().pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionProjectRepository.listAll:query")),
    );

  const deleteById: ProjectionProjectRepositoryShape["deleteById"] = (input) =>
    deleteProjectionProjectRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionProjectRepository.deleteById:query")),
    );

  return {
    upsert,
    getById,
    listAll,
    deleteById,
  } satisfies ProjectionProjectRepositoryShape;
});

export const ProjectionProjectRepositoryLive = Layer.effect(
  ProjectionProjectRepository,
  makeProjectionProjectRepository,
);
