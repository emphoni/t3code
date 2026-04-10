import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("020_BackfillProjectCreatedDefaultModelSelection", (it) => {
  it.effect("backfills null defaultModelSelection for legacy project.created events", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 19 });

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
        VALUES (
          'event-project-created-missing-default-model-selection',
          'project',
          'project-legacy',
          0,
          'project.created',
          '2026-01-01T00:00:00.000Z',
          'command-project-created-missing-default-model-selection',
          NULL,
          NULL,
          'server',
          '{"projectId":"project-legacy","title":"Legacy Project","workspaceRoot":"/tmp/project-legacy","scripts":[],"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}',
          '{}'
        )
      `;

      yield* runMigrations({ toMigrationInclusive: 20 });

      const rows = yield* sql<{
        readonly payloadJson: string;
      }>`
        SELECT payload_json AS "payloadJson"
        FROM orchestration_events
        WHERE event_id = 'event-project-created-missing-default-model-selection'
      `;

      assert.deepStrictEqual(rows, [
        {
          payloadJson:
            '{"projectId":"project-legacy","title":"Legacy Project","workspaceRoot":"/tmp/project-legacy","scripts":[],"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z","defaultModelSelection":null}',
        },
      ]);
    }),
  );
});
