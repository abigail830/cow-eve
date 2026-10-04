# Ann Researcher — long turns and leaving the window

The research agent uses the same **chat + Eve session** model as omni.

- Stream events are persisted ([`persist-chat`](../../backend/agents/research/agent/hooks/persist-chat.ts)).
- Reopening the **same chat** loads history; if the turn has not finished, the client [resumes the stream](../../frontend/src/lib/chat-stream.ts) (`historyNeedsResume`).

**Expectation:** You can navigate away and return to the same chat to continue watching or read the finished report and `publish` artifact.

**Limits:** A new chat does not inherit an in-flight turn. Session timeout and Stop behave like other agents. Fire-and-forget scheduled research is Phase 3 (Eve schedules).

**Steering:** Sending a **new message** while a turn is waiting on a workflow tool (e.g. **`research_retrieve`**) can abort that workflow. Leaving the page and returning is fine; starting a new prompt in the same chat is not equivalent to background research (unlike Gemini/Kimi async jobs). See [RESEARCH_DURABILITY.md](./RESEARCH_DURABILITY.md).

**Local dev:** `./scripts/restart.sh` starts omni (2000), research (2002), and frontend. Or run `npm run dev:omni` and `npm run dev:research` in separate terminals. Set `VITE_AGENT_URLS` to include `research=http://127.0.0.1:2002`.
