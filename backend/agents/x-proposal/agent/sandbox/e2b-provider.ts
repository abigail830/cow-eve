import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  CommandExitError,
  FileNotFoundError,
  Sandbox,
  type SandboxOpts,
} from "e2b";
import type { SandboxSession } from "eve/sandbox";
import {
  defineSandboxProvider,
  type SandboxProviderPrepareContext,
  type SandboxProviderResources,
  type SandboxProviderTargetFile,
} from "eve/sandbox/provider";

const WORKSPACE_ROOT = "/workspace";
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const BACKEND_NAME = "e2b-content-studio";
const METADATA_BACKEND_KEY = "eve.sandbox.backend";
const METADATA_SESSION_KEY = "eve.sandbox.sessionKey";

export type E2bPreparedArtifact = {
  readonly template: string;
  /** Host cache key for compiled workspace + skill seed files (Eve prewarm). */
  readonly seedBundleKey?: string;
};

const MODEL_SKILL_ROOT = "$HOME/.agents/skills";
const FALLBACK_SKILL_ROOT = "/workspace/skills";

function providerResourceTargetFiles(
  resources: SandboxProviderResources,
): SandboxProviderTargetFile[] {
  return [resources.workspace, resources.skills].flatMap((tree) =>
    tree === undefined
      ? []
      : tree.files.map((file) => ({
          content: file.content,
          path: `${tree.targetPath}/${file.relativePath}`,
        })),
  );
}

function seedBundleDirectory(storagePath: string, bundleKey: string): string {
  return join(storagePath, BACKEND_NAME, "seed-bundles", bundleKey);
}

function cacheRelativePathForTarget(targetPath: string): string {
  if (targetPath.startsWith(`${MODEL_SKILL_ROOT}/`)) {
    return join("skills", targetPath.slice(`${MODEL_SKILL_ROOT}/`.length));
  }
  if (targetPath.startsWith("/workspace/")) {
    return join("workspace", targetPath.slice("/workspace/".length));
  }
  if (targetPath.startsWith("/")) {
    return join("_abs", targetPath.slice(1));
  }
  return targetPath;
}

function targetPathFromCacheRelative(rel: string): string {
  if (rel.startsWith("skills/")) {
    return `${MODEL_SKILL_ROOT}/${rel.slice("skills/".length)}`;
  }
  if (rel.startsWith("workspace/")) {
    return `/workspace/${rel.slice("workspace/".length)}`;
  }
  if (rel.startsWith("_abs/")) {
    return `/${rel.slice("_abs/".length)}`;
  }
  return rel;
}

async function writeSeedBundleToDisk(
  cacheRoot: string,
  files: readonly SandboxProviderTargetFile[],
): Promise<void> {
  await rm(cacheRoot, { force: true, recursive: true });
  await mkdir(cacheRoot, { recursive: true });
  for (const file of files) {
    const rel = cacheRelativePathForTarget(file.path);
    const dest = join(cacheRoot, rel);
    await mkdir(dirname(dest), { recursive: true });
    const bytes =
      typeof file.content === "string"
        ? Buffer.from(file.content, "utf8")
        : Buffer.from(file.content);
    await writeFile(dest, bytes);
  }
}

async function resolveSandboxTargetPath(
  session: SandboxSession,
  targetPath: string,
): Promise<string> {
  if (!targetPath.includes("$HOME")) {
    return targetPath.startsWith("/") ? targetPath : `${WORKSPACE_ROOT}/${targetPath}`;
  }
  const homeResult = await session.run({
    command: `printf '%s' "$HOME"`,
  });
  const home = homeResult.stdout.trim();
  if (home.startsWith("/")) {
    return targetPath.replaceAll("$HOME", home);
  }
  return targetPath.replace(MODEL_SKILL_ROOT, FALLBACK_SKILL_ROOT);
}

async function hydrateSeedBundleFromDisk(
  session: SandboxSession,
  cacheRoot: string,
): Promise<void> {
  let entries: string[];
  try {
    entries = await listCacheFilesRecursive(cacheRoot, "");
  } catch {
    return;
  }
  for (const rel of entries) {
    const target = targetPathFromCacheRelative(rel);
    const resolved = await resolveSandboxTargetPath(session, target);
    const bytes = await readFile(join(cacheRoot, rel));
    await session.writeBinaryFile({ path: resolved, content: new Uint8Array(bytes) });
  }
}

async function listCacheFilesRecursive(
  root: string,
  prefix: string,
): Promise<string[]> {
  const dir = prefix ? join(root, prefix) : root;
  const names = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of names) {
    const rel = prefix ? join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await listCacheFilesRecursive(root, rel)));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

export type E2bSessionState = {
  readonly sandboxId: string;
  readonly version: 1;
};

export type E2bEnvironmentOptions = {
  readonly template: string;
  readonly autoPause: boolean;
  readonly apiKey?: string;
  readonly domain?: string;
  readonly timeoutMs?: number;
  readonly envs?: Record<string, string>;
  readonly createOptions?: SandboxOpts;
};

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function resolveWorkspacePath(path: string): string {
  return path.startsWith("/") ? path : `${WORKSPACE_ROOT}/${path}`;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function bufferToStream(buf: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
}

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  return (await streamToBuffer(stream)).toString("utf-8");
}

async function runForResult(
  sandbox: Sandbox,
  command: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const { exitCode, stdout, stderr } = await sandbox.commands.run(command, {
      background: false,
      timeoutMs: 0,
    });
    return { exitCode, stdout, stderr };
  } catch (error) {
    if (error instanceof CommandExitError) {
      return { exitCode: error.exitCode, stdout: error.stdout, stderr: error.stderr };
    }
    throw error;
  }
}

async function ensureWorkspace(sandbox: Sandbox): Promise<void> {
  const quoted = shellQuote(WORKSPACE_ROOT);
  const plain = await runForResult(sandbox, `mkdir -p ${quoted} && test -w ${quoted}`);
  if (plain.exitCode === 0) return;
  const elevated = await runForResult(
    sandbox,
    `sudo mkdir -p ${quoted} && sudo chown -R "$(id -u):$(id -g)" ${quoted}`,
  );
  if (elevated.exitCode !== 0) {
    throw new Error(
      `Failed to create ${WORKSPACE_ROOT} (exit ${elevated.exitCode}): ${elevated.stderr || plain.stderr}`,
    );
  }
}

async function createSandboxProcess(
  abortSignal: AbortSignal | undefined,
  start: (io: {
    onStdout: (data: string) => void;
    onStderr: (data: string) => void;
  }) => Promise<{
    pid: number;
    wait: () => Promise<{ exitCode: number }>;
    kill: () => Promise<unknown>;
  }>,
) {
  const encoder = new TextEncoder();
  let stdoutController!: ReadableStreamDefaultController<Uint8Array>;
  let stderrController!: ReadableStreamDefaultController<Uint8Array>;
  const stdout = new ReadableStream<Uint8Array>({
    start: (controller) => {
      stdoutController = controller;
    },
  });
  const stderr = new ReadableStream<Uint8Array>({
    start: (controller) => {
      stderrController = controller;
    },
  });
  let closed = false;
  const closeStreams = () => {
    if (closed) return;
    closed = true;
    try {
      stdoutController.close();
    } catch {
      /* ignore */
    }
    try {
      stderrController.close();
    } catch {
      /* ignore */
    }
  };
  const handle = await start({
    onStdout: (data) => stdoutController.enqueue(encoder.encode(data)),
    onStderr: (data) => stderrController.enqueue(encoder.encode(data)),
  });
  const exit = handle.wait().then(
    (result) => ({ exitCode: result.exitCode }),
    (error) => {
      if (error instanceof CommandExitError) return { exitCode: error.exitCode };
      throw error;
    },
  );
  exit.then(closeStreams, closeStreams);
  if (abortSignal?.aborted) {
    void handle.kill().catch(() => undefined);
  } else if (abortSignal) {
    const onAbort = () => void handle.kill().catch(() => undefined);
    abortSignal.addEventListener("abort", onAbort, { once: true });
    void exit.finally(() => abortSignal.removeEventListener("abort", onAbort)).catch(() => undefined);
  }
  return {
    pid: handle.pid,
    stdout,
    stderr,
    async wait() {
      try {
        const result = await exit;
        if (!abortSignal?.aborted) return result;
      } catch (error) {
        if (!abortSignal?.aborted) throw error;
      }
      throw abortSignal?.reason ?? new DOMException("Aborted", "AbortError");
    },
    async kill() {
      await handle.kill();
    },
  };
}

function buildSandboxSession(
  sandbox: Sandbox,
  sessionKey: string,
): SandboxSession {
  const internal = {
    id: sessionKey,
    resolvePath: resolveWorkspacePath,
    async spawn(options: Parameters<SandboxSession["spawn"]>[0]) {
      const { command, workingDirectory, env, abortSignal } = options;
      abortSignal?.throwIfAborted();
      return createSandboxProcess(abortSignal, ({ onStdout, onStderr }) =>
        sandbox.commands.run(command, {
          background: true,
          envs: env,
          timeoutMs: 0,
          onStdout,
          onStderr,
          signal: abortSignal,
          cwd:
            workingDirectory === undefined
              ? WORKSPACE_ROOT
              : resolveWorkspacePath(workingDirectory),
        }),
      );
    },
    async readFile(options: { path: string; abortSignal?: AbortSignal }) {
      options.abortSignal?.throwIfAborted();
      try {
        return await sandbox.files.read(resolveWorkspacePath(options.path), {
          format: "stream",
          ...(options.abortSignal ? { signal: options.abortSignal } : {}),
        });
      } catch (error) {
        if (error instanceof FileNotFoundError) return null;
        throw error;
      }
    },
    async writeFile(options: {
      path: string;
      content: ReadableStream<Uint8Array> | string;
      abortSignal?: AbortSignal;
    }) {
      options.abortSignal?.throwIfAborted();
      await sandbox.files.write(
        resolveWorkspacePath(options.path),
        options.content,
        options.abortSignal ? { signal: options.abortSignal } : undefined,
      );
    },
    async removePath(options: {
      path: string;
      force?: boolean;
      recursive?: boolean;
      abortSignal?: AbortSignal;
    }) {
      options.abortSignal?.throwIfAborted();
      const flags = `${options.recursive ? "r" : ""}${options.force ? "f" : ""}`;
      const command = `rm ${flags ? `-${flags} ` : ""}-- ${shellQuote(resolveWorkspacePath(options.path))}`;
      const process = await createSandboxProcess(options.abortSignal, ({ onStdout, onStderr }) =>
        sandbox.commands.run(command, {
          background: true,
          timeoutMs: 0,
          onStdout,
          onStderr,
          signal: options.abortSignal,
        }),
      );
      const stderrPromise = streamToString(process.stderr);
      const { exitCode } = await process.wait();
      if (exitCode !== 0) {
        const stderr = await stderrPromise;
        throw new Error(`Failed to remove "${options.path}" (exit ${exitCode}): ${stderr}`);
      }
    },
  };

  return {
    resolvePath: internal.resolvePath,
    async run(options) {
      const process = await internal.spawn(options);
      const [stdout, stderr, { exitCode }] = await Promise.all([
        streamToString(process.stdout),
        streamToString(process.stderr),
        process.wait(),
      ]);
      return { exitCode, stdout, stderr };
    },
    spawn: (options) => internal.spawn(options),
    async readFile(options) {
      return internal.readFile(options);
    },
    async readBinaryFile(options) {
      const stream = await internal.readFile(options);
      if (stream === null) return null;
      const bytes = await streamToBuffer(stream);
      return new Uint8Array(bytes);
    },
    async readTextFile(options) {
      const stream = await internal.readFile(options);
      if (stream === null) return null;
      const bytes = await streamToBuffer(stream);
      if (!options.encoding || options.encoding === "utf-8" || options.encoding === "utf8") {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      }
      return bytes.toString(options.encoding as BufferEncoding);
    },
    async writeFile(options) {
      await internal.writeFile(options);
    },
    async writeBinaryFile(options) {
      await internal.writeFile({
        ...options,
        content: bufferToStream(Buffer.from(options.content)),
      });
    },
    async writeTextFile(options) {
      const bytes =
        !options.encoding || options.encoding === "utf-8" || options.encoding === "utf8"
          ? Buffer.from(new TextEncoder().encode(options.content))
          : Buffer.from(options.content, options.encoding as BufferEncoding);
      await internal.writeFile({
        path: options.path,
        content: bufferToStream(bytes),
        abortSignal: options.abortSignal,
      });
    },
    removePath: (options) => internal.removePath(options),
  };
}

function baseCreateOptions(
  options: E2bEnvironmentOptions,
  sessionKey: string,
): SandboxOpts {
  return {
    ...options.createOptions,
    apiKey: options.apiKey,
    domain: options.domain,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    lifecycle:
      options.createOptions?.lifecycle ??
      (options.autoPause
        ? { onTimeout: "pause", autoResume: true }
        : { onTimeout: "kill" }),
    envs: { ...options.createOptions?.envs, ...options.envs },
    metadata: {
      ...options.createOptions?.metadata,
      [METADATA_BACKEND_KEY]: BACKEND_NAME,
      [METADATA_SESSION_KEY]: sessionKey,
    },
  };
}

async function openSandbox(
  options: E2bEnvironmentOptions,
  sessionKey: string,
  template: string,
): Promise<Sandbox> {
  const connectOptions = {
    apiKey: options.apiKey,
    domain: options.domain,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
  const createOptions = baseCreateOptions(options, sessionKey);
  const sandbox = await Sandbox.create(template, createOptions);
  try {
    await ensureWorkspace(sandbox);
    return sandbox;
  } catch (error) {
    await sandbox.kill().catch(() => undefined);
    throw error;
  }
}

async function reconnectSandbox(
  options: E2bEnvironmentOptions,
  sessionKey: string,
  sandboxId: string,
): Promise<Sandbox | null> {
  const connectOptions = {
    apiKey: options.apiKey,
    domain: options.domain,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
  try {
    return await Sandbox.connect(sandboxId, connectOptions);
  } catch {
    return null;
  }
}

export function contentStudioTemplate(): string {
  return process.env.E2B_CONTENT_STUDIO_TEMPLATE?.trim() || "okf-content-studio";
}

/** Global npm modules in the Content Studio E2B image (pptxgenjs, docx, sharp, …). */
export function contentStudioNodePath(): string {
  return (
    process.env.CONTENT_STUDIO_NODE_PATH?.trim() || "/usr/local/lib/node_modules"
  );
}

function readAutoPause(): boolean {
  const raw = process.env.E2B_AUTO_PAUSE?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function contentStudioEnvironmentOptions(): E2bEnvironmentOptions {
  const nodePath = contentStudioNodePath();
  return {
    template: contentStudioTemplate(),
    autoPause: readAutoPause(),
    envs: { NODE_PATH: nodePath },
  };
}

export const E2bContentStudio = defineSandboxProvider<
  E2bEnvironmentOptions,
  undefined,
  E2bPreparedArtifact,
  E2bSessionState,
  SandboxSession
>({
  name: BACKEND_NAME,
  environment(options = contentStudioEnvironmentOptions()) {
    return {
      async prepare(ctx: SandboxProviderPrepareContext) {
        const files = providerResourceTargetFiles(ctx.resources);
        let seedBundleKey: string | undefined;
        if (
          files.length > 0 &&
          ctx.resources.source.kind !== "none" &&
          ctx.resources.source.key
        ) {
          seedBundleKey = ctx.resources.source.key;
          await writeSeedBundleToDisk(
            seedBundleDirectory(ctx.storagePath, seedBundleKey),
            files,
          );
        }
        return { template: options.template, seedBundleKey };
      },

      async start(ctx, _liveOptions, artifact) {
        const sessionKey = ctx.session.id;
        const sandbox = await openSandbox(options, sessionKey, artifact.template);
        const session = buildSandboxSession(sandbox, sessionKey);
        if (artifact.seedBundleKey) {
          await hydrateSeedBundleFromDisk(
            session,
            seedBundleDirectory(ctx.storagePath, artifact.seedBundleKey),
          );
        }
        return {
          state: { sandboxId: sandbox.sandboxId, version: 1 },
          handle: {
            sandbox: session,
            async onSessionStop() {
              await Sandbox.pause(sandbox.sandboxId, { keepMemory: false });
            },
            async onSessionDelete() {
              await Sandbox.kill(sandbox.sandboxId);
            },
            async onRuntimeShutdown() {
              /* rely on autoPause + reconnect */
            },
          },
        };
      },

      async resume(ctx, _artifact, state) {
        const sessionKey = ctx.session.id;
        const sandbox = await reconnectSandbox(options, sessionKey, state.sandboxId);
        if (!sandbox) {
          throw new Error(
            `E2B sandbox ${state.sandboxId} is no longer available for session ${sessionKey}. Start a new chat.`,
          );
        }
        const session = buildSandboxSession(sandbox, sessionKey);
        if (_artifact.seedBundleKey) {
          await hydrateSeedBundleFromDisk(
            session,
            seedBundleDirectory(ctx.storagePath, _artifact.seedBundleKey),
          );
        }
        return {
          sandbox: session,
          async onSessionStop() {
            await Sandbox.pause(sandbox.sandboxId, { keepMemory: false });
          },
          async onSessionDelete() {
            await Sandbox.kill(sandbox.sandboxId);
          },
          async onRuntimeShutdown() {},
        };
      },
    };
  },
});

export function contentStudioEnvironment() {
  return E2bContentStudio.environment(contentStudioEnvironmentOptions());
}
