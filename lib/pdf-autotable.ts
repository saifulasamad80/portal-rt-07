import type { jsPDF } from "jspdf";

export type DokumenPdfDenganAutoTable = jsPDF & {
  lastAutoTable?: { finalY?: number };
};

export function posisiAkhirTabelPdf(dokumen: jsPDF, cadangan = 40): number {
  const denganPlugin = dokumen as DokumenPdfDenganAutoTable;
  return denganPlugin.lastAutoTable?.finalY ?? cadangan;
}
