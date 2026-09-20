type OoxmlKind = "docx" | "pptx";

/** Served from frontend/public/ooxml (copied on postinstall). */
const OOXML_WASM: Record<OoxmlKind, string> = {
  docx: "/ooxml/docx_parser_bg.wasm",
  pptx: "/ooxml/pptx_parser_bg.wasm",
};

type ScrollViewer = {
  load: (source: string | ArrayBuffer) => Promise<void>;
  destroy: () => void;
};

type DeskOptions = {
  background: string;
  gap: number;
  paddingTop: number;
  wasmUrl: string;
};

const moduleByKind: Partial<
  Record<OoxmlKind, Promise<typeof import("@silurus/ooxml/docx") | typeof import("@silurus/ooxml/pptx")>>
> = {};
const wasmReady: Partial<Record<OoxmlKind, Promise<void>>> = {};

function loadWasm(kind: OoxmlKind): Promise<void> {
  wasmReady[kind] ??= fetch(OOXML_WASM[kind]).then((res) => {
    if (!res.ok) throw new Error(`Failed to load ${kind} wasm (${res.status})`);
  });
  return wasmReady[kind]!;
}

function loadModule(kind: OoxmlKind) {
  if (kind === "docx") {
    moduleByKind.docx ??= import("@silurus/ooxml/docx");
    return moduleByKind.docx as Promise<typeof import("@silurus/ooxml/docx")>;
  }
  moduleByKind.pptx ??= import("@silurus/ooxml/pptx");
  return moduleByKind.pptx as Promise<typeof import("@silurus/ooxml/pptx")>;
}

/** Load only the viewer kind the user opened — cached for the rest of the tab. */
export async function createOoxmlScrollViewer(
  kind: OoxmlKind,
  container: HTMLElement,
): Promise<ScrollViewer> {
  const deskOptions: DeskOptions = {
    background: "#f3f4f6",
    gap: 16,
    paddingTop: 16,
    wasmUrl: OOXML_WASM[kind],
  };

  const [, mod] = await Promise.all([loadWasm(kind), loadModule(kind)]);

  if (kind === "docx") {
    const { DocxScrollViewer } = mod as typeof import("@silurus/ooxml/docx");
    return new DocxScrollViewer(container, deskOptions);
  }

  const { PptxScrollViewer } = mod as typeof import("@silurus/ooxml/pptx");
  return new PptxScrollViewer(container, deskOptions);
}
