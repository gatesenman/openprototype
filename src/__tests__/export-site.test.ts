import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { demoGpo } from "@/export/demoGpo";
import { exportSite } from "@/export/exportSite";

describe("static site export from a .gpo fixture", () => {
  it("writes index.html with both frames and navigation links", () => {
    const dir = mkdtempSync(join(tmpdir(), "gpo-site-"));
    try {
      const result = exportSite(demoGpo(), dir);
      expect(result.files).toContain("index.html");
      expect(result.frameIds).toEqual(["home", "checkout"]);
      const html = readFileSync(join(dir, "index.html"), "utf8");
      expect(html).toContain("id=\"frame-home\"");
      expect(html).toContain("id=\"frame-checkout\"");
      expect(html).toContain("gotoFrame('checkout'");
      expect(html).toContain("gotoFrame('home'");
      expect(html).toContain("Starter checkout");
      const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
      expect(manifest.frames).toEqual(["home", "checkout"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
