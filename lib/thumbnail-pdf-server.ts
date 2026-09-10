import "server-only";

import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { BATAS_BYTE_PDF } from "@/lib/batas-berkas-unggah";

const globalPdf = globalThis as typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler };
};
globalPdf.pdfjsWorker = { WorkerMessageHandler };

class PabrikKanvasNode {
  create(width: number, height: number) {
    const canvas = createCanvas(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(canvasAndContext: { canvas: { width: number; height: number } }, width: number, height: number) {
    canvasAndContext.canvas.width = Math.max(1, Math.floor(width));
    canvasAndContext.canvas.height = Math.max(1, Math.floor(height));
  }
  destroy(canvasAndContext: { canvas: { width: number; height: number } | null; context: unknown }) {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

function urlDirektoriPdfjs(sub: string) {
  const akar = path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  return `${pathToFileURL(path.join(akar, sub)).href}/`;
}

export async function jpegHalamanPertamaPdfServer(pdf: Buffer): Promise<Buffer | null> {
  if (!pdf.length || pdf.length > BATAS_BYTE_PDF) return null;
  const tugas = getDocument({
    data: new Uint8Array(pdf),
    isEvalSupported: false,
    disableFontFace: true,
    useWasm: true,
    verbosity: 0,
    CanvasFactory: PabrikKanvasNode,
    wasmUrl: urlDirektoriPdfjs("wasm"),
    cMapUrl: urlDirektoriPdfjs("cmaps"),
    cMapPacked: true,
    standardFontDataUrl: urlDirektoriPdfjs("standard_fonts"),
  } as never);
  try {
    const dokumen = await tugas.promise;
    const halaman = await dokumen.getPage(1);
    const dasar = halaman.getViewport({ scale: 1 });
    const skala = Math.min(480 / dasar.width, 480 / dasar.height);
    const viewport = halaman.getViewport({ scale: skala });
    const canvas = createCanvas(
      Math.max(1, Math.floor(viewport.width)),
      Math.max(1, Math.floor(viewport.height)),
    );
    await halaman.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
      canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
    }).promise;
    return canvas.toBuffer("image/jpeg", 72);
  } catch (error) {
    console.error("Gagal merender thumbnail PDF:", error);
    return null;
  } finally {
    await tugas.destroy();
  }
}
