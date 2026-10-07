import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clipboardTextBesideImages,
  imageFilesFromClipboard,
  normalizeClipboardImageFile,
} from "./clipboardImages.js";

const NOW = new Date("2026-10-07T12:02:00");

function pngBytes(): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  new Uint8Array(buffer).set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buffer;
}

describe("normalizeClipboardImageFile", () => {
  it("fills an empty screenshot MIME and renames image.png", () => {
    const raw = new File([pngBytes()], "image.png", { type: "" });
    const file = normalizeClipboardImageFile(raw, "image/png", NOW);
    assert.ok(file);
    assert.equal(file.type, "image/png");
    assert.equal(file.name, "screenshot-20261007-120200.png");
    assert.equal(file.size, pngBytes().byteLength);
  });

  it("keeps a real filename and type from the paperclip-equivalent file", () => {
    const raw = new File([pngBytes()], "board.png", { type: "image/png" });
    const file = normalizeClipboardImageFile(raw, "image/png", NOW);
    assert.equal(file, raw);
  });

  it("ignores non-images", () => {
    const raw = new File(["hello"], "notes.txt", { type: "text/plain" });
    assert.equal(normalizeClipboardImageFile(raw, "text/plain", NOW), null);
  });
});

describe("imageFilesFromClipboard", () => {
  it("reads a screenshot whose type lives only on the clipboard item", () => {
    const raw = new File([pngBytes()], "image.png", { type: "" });
    const files = imageFilesFromClipboard(
      {
        files: { length: 0 },
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => raw,
          },
        ],
      },
      NOW,
    );
    assert.equal(files.length, 1);
    assert.equal(files[0]?.type, "image/png");
    assert.equal(files[0]?.name, "screenshot-20261007-120200.png");
  });

  it("dedupes the same image listed in files and items", () => {
    const raw = new File([pngBytes()], "board.png", { type: "image/png" });
    const files = imageFilesFromClipboard(
      {
        files: [raw],
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => raw,
          },
        ],
      },
      NOW,
    );
    assert.equal(files.length, 1);
    assert.equal(files[0]?.name, "board.png");
  });
});

describe("clipboardTextBesideImages", () => {
  it("drops the generic screenshot filename browsers put on the clipboard", () => {
    assert.equal(
      clipboardTextBesideImages({ getData: () => "image.png" }),
      "",
    );
  });

  it("keeps real text pasted alongside an image", () => {
    assert.equal(
      clipboardTextBesideImages({ getData: () => "see this chart" }),
      "see this chart",
    );
  });
});
