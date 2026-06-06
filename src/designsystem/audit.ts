import { DesignSystem } from "@/schema/types";

export interface AuditFinding {
  level: "ok" | "warn" | "error";
  message: string;
}

/** Relative luminance (WCAG) of a hex color. */
function luminance(hex: string): number | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const srgb = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/** WCAG contrast ratio between two hex colors (1..21), or null if unparseable. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * A senior-PM / designer health check of the design system: verifies it has the
 * standard primitives (semantic colors, a type scale, spacing, radii, elevation)
 * and flags accessibility (contrast) and consistency problems.
 */
export function auditDesignSystem(ds: DesignSystem): AuditFinding[] {
  const out: AuditFinding[] = [];
  const t = ds.tokens;

  // Required semantic colors.
  const requiredColors = ["primary", "primary-fg", "bg", "surface", "border", "text", "muted"];
  const missing = requiredColors.filter((k) => !t.colors[k]);
  if (missing.length) {
    out.push({ level: "error", message: `缺少标准语义色：${missing.join(", ")}` });
  } else {
    out.push({ level: "ok", message: "标准语义色齐全（primary/bg/surface/border/text…）" });
  }

  // Primary button contrast (WCAG AA for large/UI text ≈ 4.5).
  if (t.colors.primary && t.colors["primary-fg"]) {
    const ratio = contrastRatio(t.colors.primary, t.colors["primary-fg"]);
    if (ratio !== null) {
      if (ratio >= 4.5) {
        out.push({ level: "ok", message: `主色对比度 ${ratio.toFixed(2)}:1，达 WCAG AA` });
      } else {
        out.push({
          level: "warn",
          message: `主色/前景对比度仅 ${ratio.toFixed(2)}:1，低于 WCAG AA 4.5:1`,
        });
      }
    }
  }

  // Type scale should have at least 4 steps.
  const sizeCount = Object.keys(t.fonts.sizes).length;
  out.push(
    sizeCount >= 4
      ? { level: "ok", message: `字阶 ${sizeCount} 级，满足层级表达` }
      : { level: "warn", message: `字阶仅 ${sizeCount} 级，建议 ≥4 级` },
  );

  // Spacing scale.
  out.push(
    Object.keys(t.spacing).length >= 4
      ? { level: "ok", message: `间距 ${Object.keys(t.spacing).length} 级` }
      : { level: "warn", message: "间距级数偏少，建议建立 4/8 基线" },
  );

  // Radii.
  if (!Object.keys(t.radii).length) {
    out.push({ level: "warn", message: "未定义圆角 token" });
  }

  // Elevation / shadow scale.
  out.push(
    t.elevation && Object.keys(t.elevation).length >= 2
      ? { level: "ok", message: `阴影/层级 ${Object.keys(t.elevation).length} 级` }
      : { level: "warn", message: "缺少标准阴影/层级（elevation）规模" },
  );

  return out;
}
