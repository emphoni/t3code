import * as SqlClient from "effect/unstable/sql/SqlClient";
import { Effect } from "effect";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_tasks (
      task_id       TEXT    NOT NULL PRIMARY KEY,
      project_id    TEXT    NOT NULL,
      title         TEXT    NOT NULL,
      description   TEXT,
      status        TEXT    NOT NULL DEFAULT 'todo',
      priority      TEXT    NOT NULL DEFAULT 'medium',
      due_date      TEXT,
      created_at    TEXT    NOT NULL,
      updated_at    TEXT    NOT NULL,
      completed_at  TEXT,
      deleted_at    TEXT
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_tasks_project_id
    ON projection_tasks (project_id, created_at ASC)
  `;
});
