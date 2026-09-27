# Platform product turns (Eve stream)

Cow Eve **product UI** (composer cards, parse pipelines, attachment library) must appear in chat **in order**, **after reload**, and **alongside agent turns** without a second parallel timeline.

Eve does not ship a “card Q&A” widget. The durable contract is the **session NDJSON stream** (`chat_events` mirror). Agent artifacts already use **`dynamic-tool` parts** from tool `publish` / `publish_artifact`. Platform product flows reuse that surface.

## Pattern: Platform Product Turn (PPT)

A PPT is a **synthetic Eve turn** appended by the platform (not the LLM), persisted with the same envelope as runtime events:

| Event | Role |
|-------|------|
| `turn.started` | Boundaries the product turn (`turnId = turn_pt_<product>_<id>`). |
| `message.received` | User leg — structured `parts` + `platform` payload (see below). |
| `actions.requested` | Synthetic tool call (internal deliver tool). |
| `action.result` | Assistant leg — same JSON shape as `publish` tool success (`ArtifactSpec`). |
| `turn.completed` | Closes the turn. |
| `session.waiting` | Optional — omit when appending during an active Eve turn (platform start while agent is streaming). |

**Idempotency:** one PPT per product instance id (e.g. `captureId`). Before append, scan `chat_events` for `platform.instanceId`.

**Live session:** the Eve client store is seeded from `initialEvents` on mount. After append, the web app **reloads bound session** (`fetchChat` → new `streamIndex` → remount `useEveAgent` via `bound.key`).

**Live status:** the assistant `action.result` carries a snapshot `ArtifactSpec`. Parse progress / retry still keyed by `artifact_id` (= output attachment id) via the attachment library poll — do not rewrite the stream on every parse webhook.

## `message.received` platform payload

```json
{
  "type": "message.received",
  "data": {
    "message": "Audio transcript",
    "kind": "execution.platform_product",
    "parts": [
      { "type": "text", "text": "Audio transcript" },
      {
        "type": "text",
        "text": "Platform attachment refs: {\"product\":\"audio_transcript\",\"instanceId\":\"…\",\"outputAttachmentId\":\"…\",\"attachmentIds\":[\"…\",\"…\"]}"
      },
      { "type": "file", "filename": "meeting.m4a", "mediaType": "audio/mp4", "size": 12345 }
    ],
    "platform": {
      "product": "audio_transcript",
      "version": 1,
      "instanceId": "<captureId>",
      "title": "Audio transcript"
    },
    "sequence": 0,
    "turnId": "turn_pt_audio_<captureId>"
  },
  "meta": { "id": "evt_…", "at": "…" }
}
```

Frontend treats `kind === execution.platform_product` as **product user leg** (custom card, not plain text bubble).

## Assistant leg — reuse artifact tools

Use tool name **`publish`** (or alias `publish_artifact`) in `actions.requested` / `action.result` so `@fde/artifact-ui` `resolveArtifactToolPart` works unchanged.

Set on `ArtifactSpec`:

- `source: "audio_transcript"`
- `artifact_id`: output attachment id
- `kind: "content_document"`, `format: "markdown"`
- `download_url` / paths as today

Optional future: internal tool `platform__deliver_artifact` registered in omni (no LLM exposure) for clearer semantics; renderer registers both names.

## Domain data vs stream

| Concern | Source of truth |
|---------|-----------------|
| Turn order & reload | `chat_events` (Eve stream) |
| Audio bytes, parts, parse jobs | `audio_captures`, `chat_attachments`, `parse_job_runs` |
| Transcript body | parsed artifact `content_md` |
| Gist | attachment row after parse `ready` |

Do **not** render a second list from `GET /audio-captures` when a PPT exists for that `instanceId` (legacy chats may still use the API-only path until migrated).

## Adding the next product

1. Add `platform.product` enum value + user card component.
2. Implement `buildXProductTurnEvents()` → call `appendPlatformProductTurn()`.
3. Register assistant renderer (artifact spec and/or custom `dynamic-tool` tool name).
4. Hook product “commit” action (e.g. Start, Submit) to append PPT once.
5. Document in this file.

## Agent context (reload / replay)

Do **not** embed transcript bytes or gist in the stream. Add a second user `text` part:

```text
Platform attachment refs: {"product":"audio_transcript","instanceId":"<captureId>","outputAttachmentId":"<uuid>","attachmentIds":["<output>","<audioPart>",…]}
```

- Uses **`Platform attachment refs:`**, not `Client context:` — so omni does **not** auto-hydrate full `content_md` on every later turn (that prefix is reserved for composer send hints).
- After reload, Eve replays this line in history; the model sees **ids only** and can call `attachment_read` / `attachment_grep` / `@mention` when it needs depth.
- `attachmentIds` lists **output first**, then source audio part ids. `artifact_id` on the publish result should match `outputAttachmentId`.

## References

- Eve: [Sessions, Runs & Streaming](https://eve.dev/docs/concepts/sessions-runs-and-streaming.md) — event types, `meta.id`, reload.
- Cow Eve: `persist-chat` hook, `fetchBoundSession`, `resolveArtifactToolPart`.
