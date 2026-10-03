import { and, eq } from "drizzle-orm";
import {
  projectKbPreferences,
  userAgentKbPreferences,
} from "../database/schema.js";
import { requireDb } from "../database/client.js";
import {
  getProjectForUser,
  touchProjectUpdatedAt,
} from "../project/drizzle-project.repository.js";

function cleanDisabledIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<string>();
  for (const item of raw) {
    const id = String(item ?? "").trim();
    if (id) set.add(id);
  }
  return [...set].sort();
}

export async function getUserAgentDisabledKbIds(input: {
  userId: string;
  agentId: string;
}): Promise<string[]> {
  const db = requireDb();
  const row = await db.query.userAgentKbPreferences.findFirst({
    where: and(
      eq(userAgentKbPreferences.userId, input.userId),
      eq(userAgentKbPreferences.agentId, input.agentId),
    ),
    columns: { disabledKbIds: true },
  });
  return cleanDisabledIds(row?.disabledKbIds);
}

export async function setUserAgentDisabledKbIds(input: {
  userId: string;
  agentId: string;
  disabledKbIds: readonly string[];
}): Promise<string[]> {
  const cleaned = cleanDisabledIds([...input.disabledKbIds]);
  const db = requireDb();
  await db
    .insert(userAgentKbPreferences)
    .values({
      userId: input.userId,
      agentId: input.agentId,
      disabledKbIds: cleaned,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        userAgentKbPreferences.userId,
        userAgentKbPreferences.agentId,
      ],
      set: { disabledKbIds: cleaned, updatedAt: new Date() },
    });
  return cleaned;
}

export async function getProjectDisabledKbIds(input: {
  userId: string;
  projectId: string;
}): Promise<string[]> {
  const project = await getProjectForUser({
    userId: input.userId,
    projectId: input.projectId,
  });
  if (!project) throw new Error("Project not found.");

  const db = requireDb();
  const row = await db.query.projectKbPreferences.findFirst({
    where: eq(projectKbPreferences.projectId, input.projectId),
    columns: { disabledKbIds: true },
  });
  return cleanDisabledIds(row?.disabledKbIds);
}

export async function setProjectDisabledKbIds(input: {
  userId: string;
  projectId: string;
  disabledKbIds: readonly string[];
}): Promise<string[]> {
  const project = await getProjectForUser({
    userId: input.userId,
    projectId: input.projectId,
  });
  if (!project) throw new Error("Project not found.");

  const cleaned = cleanDisabledIds([...input.disabledKbIds]);
  const db = requireDb();
  await db
    .insert(projectKbPreferences)
    .values({
      projectId: input.projectId,
      disabledKbIds: cleaned,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: projectKbPreferences.projectId,
      set: { disabledKbIds: cleaned, updatedAt: new Date() },
    });
  await touchProjectUpdatedAt(input.projectId);
  return cleaned;
}
