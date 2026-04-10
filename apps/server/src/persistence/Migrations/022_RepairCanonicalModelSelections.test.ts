import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("022_RepairCanonicalModelSelections", (it) => {
  it.effect("repairs legacy projection schema and canonicalizes legacy model payloads", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 5 });

      yield* sql`
        ALTER TABLE projection_threads
        ADD COLUMN runtime_mode TEXT NOT NULL DEFAULT 'full-access'
      `;
      yield* sql`
        ALTER TABLE projection_threads
        ADD COLUMN interaction_mode TEXT NOT NULL DEFAULT 'default'
      `;
      yield* sql`
        ALTER TABLE projection_threads
        ADD COLUMN archived_at TEXT
      `;
      yield* sql`
        CREATE INDEX IF NOT EXISTS idx_projection_threads_project_archived_at
        ON projection_threads(project_id, archived_at)
      `;
      yield* sql`
        CREATE TABLE IF NOT EXISTS projection_tasks (
          task_id TEXT NOT NULL PRIMARY KEY,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'todo',
          priority TEXT NOT NULL DEFAULT 'medium',
          due_date TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          deleted_at TEXT
        )
      `;
      yield* sql`
        CREATE INDEX IF NOT EXISTS idx_projection_tasks_project_id
        ON projection_tasks (project_id, created_at ASC)
      `;
      yield* sql`
        INSERT INTO effect_sql_migrations (migration_id, name)
        VALUES
          (6, 'ProjectionThreadSessionRuntimeModeColumns'),
          (7, 'ProjectionThreadMessageAttachments'),
          (8, 'ProjectionThreadActivitySequence'),
          (9, 'ProviderSessionRuntimeMode'),
          (10, 'ProjectionThreadsRuntimeMode'),
          (11, 'OrchestrationThreadCreatedRuntimeMode'),
          (12, 'ProjectionThreadsInteractionMode'),
          (13, 'ProjectionThreadProposedPlans'),
          (14, 'ProjectionThreadProposedPlanImplementation'),
          (15, 'ProjectionTurnsSourceProposedPlan'),
          (16, 'ProjectionTasks'),
          (17, 'ProjectionThreadsArchivedAt'),
          (18, 'ProjectionThreadsArchivedAtIndex'),
          (19, 'ProjectionTasks'),
          (20, 'BackfillProjectCreatedDefaultModelSelection'),
          (21, 'BackfillThreadCreatedModelSelection')
      `;

      yield* sql`
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
          'project-legacy',
          'Legacy Project',
          '/tmp/project-legacy',
          'claude-opus-4-6',
          '[]',
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
          NULL
        )
      `;

      yield* sql`
        INSERT INTO projection_threads (
          thread_id,
          project_id,
          title,
          model,
          branch,
          worktree_path,
          latest_turn_id,
          created_at,
          updated_at,
          deleted_at,
          runtime_mode,
          interaction_mode,
          archived_at
        )
        VALUES (
          'thread-legacy',
          'project-legacy',
          'Legacy Thread',
          'claude-opus-4-6',
          NULL,
          NULL,
          NULL,
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
          NULL,
          'full-access',
          'default',
          NULL
        )
      `;

      yield* sql`
        INSERT INTO orchestration_events (
          event_id,
          aggregate_kind,
          stream_id,
          stream_version,
          event_type,
          occurred_at,
          command_id,
          causation_event_id,
          correlation_id,
          actor_kind,
          payload_json,
          metadata_json
        )
        VALUES
        (
          'event-project-created-legacy-model',
          'project',
          'project-legacy',
          0,
          'project.created',
          '2026-01-01T00:00:00.000Z',
          'command-project-created-legacy-model',
          NULL,
          NULL,
          'server',
          '{"projectId":"project-legacy","title":"Legacy Project","workspaceRoot":"/tmp/project-legacy","defaultModel":"claude-opus-4-6","scripts":[],"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}',
          '{}'
        ),
        (
          'event-thread-created-legacy-model',
          'thread',
          'thread-legacy',
          0,
          'thread.created',
          '2026-01-01T00:00:00.000Z',
          'command-thread-created-legacy-model',
          NULL,
          NULL,
          'server',
          '{"threadId":"thread-legacy","projectId":"project-legacy","title":"Legacy Thread","model":"claude-opus-4-6","runtimeMode":"full-access","interactionMode":"default","branch":null,"worktreePath":null,"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}',
          '{}'
        )
      `;

      yield* runMigrations({ toMigrationInclusive: 22 });

      const projectColumns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_projects)
      `;
      const threadColumns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_threads)
      `;

      assert.ok(projectColumns.some((column) => column.name === "default_model_selection_json"));
      assert.ok(threadColumns.some((column) => column.name === "model_selection_json"));

      const repairedProjects = yield* sql<{
        readonly modelSelection: string | null;
      }>`
        SELECT default_model_selection_json AS "modelSelection"
        FROM projection_projects
        WHERE project_id = 'project-legacy'
      `;
      assert.deepStrictEqual(repairedProjects, [
        {
          modelSelection: '{"provider":"claudeAgent","model":"claude-opus-4-6"}',
        },
      ]);

      const repairedThreads = yield* sql<{
        readonly modelSelection: string | null;
      }>`
        SELECT model_selection_json AS "modelSelection"
        FROM projection_threads
        WHERE thread_id = 'thread-legacy'
      `;
      assert.deepStrictEqual(repairedThreads, [
        {
          modelSelection: '{"provider":"claudeAgent","model":"claude-opus-4-6"}',
        },
      ]);

      const eventRows = yield* sql<{
        readonly eventId: string;
        readonly payloadJson: string;
      }>`
        SELECT event_id AS "eventId", payload_json AS "payloadJson"
        FROM orchestration_events
        WHERE event_id IN ('event-project-created-legacy-model', 'event-thread-created-legacy-model')
        ORDER BY event_id ASC
      `;

      assert.deepStrictEqual(JSON.parse(eventRows[0]!.payloadJson), {
        projectId: "project-legacy",
        title: "Legacy Project",
        workspaceRoot: "/tmp/project-legacy",
        defaultModelSelection: {
          provider: "claudeAgent",
          model: "claude-opus-4-6",
        },
        scripts: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });

      assert.deepStrictEqual(JSON.parse(eventRows[1]!.payloadJson), {
        threadId: "thread-legacy",
        projectId: "project-legacy",
        title: "Legacy Thread",
        modelSelection: {
          provider: "claudeAgent",
          model: "claude-opus-4-6",
        },
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    }),
  );
});
