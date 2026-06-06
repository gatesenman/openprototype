import { Frame } from "@/schema/types";
import { exportFramePng } from "./exportPng";

/** Decode a base64 string to a byte array. */
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/**
 * Build a single-page PDF that embeds a JPEG image at the given pixel size.
 * Produces a valid PDF 1.4 with a correct xref table (byte-accurate offsets).
 */
function jpegToPdf(jpeg: Uint8Array, wPx: number, hPx: number): Blob {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: Uint8Array | string) => {
    const u = typeof data === "string" ? enc(data) : data;
    chunks.push(u);
    length += u.length;
  };
  const obj = (n: number, body: string) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };

  push("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPx} ${hPx}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );

  // Image XObject (object 4) — written as raw chunks to preserve binary JPEG.
  offsets[4] = length;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push("\nendstream\nendobj\n");

  const content = `q\n${wPx} 0 0 ${hPx} 0 0 cm\n/Im0 Do\nQ\n`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}endstream`);

  const xrefStart = length;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

/** Async PDF export: rasterize → JPEG → single-page PDF, then download. */
export async function downloadFramePdf(frame: Frame, name: string): Promise<boolean> {
  const pngUrl = exportFramePng(frame);
  if (!pngUrl) return false;
  const img = new Image();
  const loaded = new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
  });
  img.src = pngUrl;
  if (!(await loaded)) return false;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const jpegUrl = canvas.toDataURL("image/jpeg", 0.92);
  const jpeg = b64ToBytes(jpegUrl.split(",")[1]);

  const blob = jpegToPdf(jpeg, frame.width, frame.height);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name || "frame"}.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}
