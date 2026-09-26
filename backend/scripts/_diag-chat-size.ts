import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL?.trim();
if (!url) throw new Error("DATABASE_URL missing");

const sql = neon(url);

const chats = await sql`
  SELECT
    c.id,
    left(coalesce(c.title, ''), 50) AS title,
    c.eve_stream_index,
    (
      SELECT count(*) FROM chat_events e WHERE e.chat_id = c.id
    ) AS event_count,
    (
      SELECT coalesce(sum(pg_column_size(e.payload)), 0)
      FROM chat_events e
      WHERE e.chat_id = c.id
    ) AS payload_bytes,
    (
      SELECT e.type
      FROM chat_events e
      WHERE e.chat_id = c.id
      ORDER BY e.emitted_at DESC
      LIMIT 1
    ) AS last_type
  FROM chats c
  WHERE c.deleted_at IS NULL
  ORDER BY c.updated_at DESC
  LIMIT 15
`;

console.log("chats:");
for (const row of chats) {
  const bytes = Number(row.payload_bytes);
  console.log(
    JSON.stringify({
      id: row.id,
      title: row.title,
      events: Number(row.event_count),
      streamIndex: row.eve_stream_index,
      payloadMB: (bytes / (1024 * 1024)).toFixed(2),
      lastType: row.last_type,
    }),
  );
}

const biggest = chats[0]?.id;
if (biggest) {
  const types = await sql`
    SELECT type, count(*) AS n, coalesce(sum(pg_column_size(payload)), 0) AS bytes
    FROM chat_events
    WHERE chat_id = ${biggest}
    GROUP BY type
    ORDER BY bytes DESC
  `;
  console.log("\nlargest chat event types:");
  for (const row of types) {
    console.log(
      JSON.stringify({
        type: row.type,
        n: Number(row.n),
        mb: (Number(row.bytes) / (1024 * 1024)).toFixed(2),
      }),
    );
  }
}
