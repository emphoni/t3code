import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("021_BackfillThreadCreatedModelSelection", (it) => {
  it.effect("backfills default modelSelection for legacy thread.created events", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 20 });

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
          'event-thread-created-missing-model-selection',
          'thread',
          'thread-legacy',
          0,
          'thread.created',
          '2026-01-01T00:00:00.000Z',
          'command-thread-created-missing-model-selection',
          NULL,
          NULL,
          'server',
          '{"threadId":"thread-legacy","projectId":"project-legacy","title":"Legacy Thread","runtimeMode":"full-access","interactionMode":"default","branch":null,"worktreePath":null,"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}',
          '{}'
        )
      `;

      yield* runMigrations({ toMigrationInclusive: 21 });

      const rows = yield* sql<{
        readonly payloadJson: string;
      }>`
        SELECT payload_json AS "payloadJson"
        FROM orchestration_events
        WHERE event_id = 'event-thread-created-missing-model-selection'
      `;

      assert.deepStrictEqual(rows, [
        {
          payloadJson:
            '{"threadId":"thread-legacy","projectId":"project-legacy","title":"Legacy Thread","runtimeMode":"full-access","interactionMode":"default","branch":null,"worktreePath":null,"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z","modelSelection":{"provider":"codex","model":"gpt-5.4"}}',
        },
      ]);
    }),
  );
});
