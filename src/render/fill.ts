import { BlendMode, DesignSystem, GradientStop, Node } from "@/schema/types";
import { resolveFill } from "./resolve";

/** Endpoints of a linear-gradient line across a w×h box for a given angle (deg). */
export function linearGradientEndpoints(
  angleDeg: number,
  w: number,
  h: number,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  return {
    start: { x: w / 2 - (dx * w) / 2, y: h / 2 - (dy * h) / 2 },
    end: { x: w / 2 + (dx * w) / 2, y: h / 2 + (dy * h) / 2 },
  };
}

/** Flatten stops into Konva's [offset, color, offset, color, ...] form. */
export function gradientColorStops(stops: GradientStop[]): (number | string)[] {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  return sorted.flatMap((s) => [s.offset, s.color]);
}

/** Map a Figma-style blend mode to a Canvas globalCompositeOperation. */
export function blendModeToComposite(mode: BlendMode | undefined): string {
  if (!mode || mode === "normal") return "source-over";
  return mode;
}

/**
 * Build the Konva fill-related props for a node (solid / gradient / image / token).
 * `image` is the loaded HTMLImageElement for image fills (when available).
 */
export function konvaFillProps(
  node: Node,
  ds: DesignSystem,
  fallback: string,
  image?: HTMLImageElement | null,
): Record<string, unknown> {
  const fill = node.style.fill;
  const blend = { globalCompositeOperation: blendModeToComposite(node.style.blendMode) };

  if (fill?.type === "linear") {
    const { start, end } = linearGradientEndpoints(fill.angle ?? 0, node.width, node.height);
    return {
      ...blend,
      fillPriority: "linear-gradient",
      fillLinearGradientStartPoint: start,
      fillLinearGradientEndPoint: end,
      fillLinearGradientColorStops: gradientColorStops(fill.stops),
    };
  }
  if (fill?.type === "radial") {
    const cx = node.width / 2;
    const cy = node.height / 2;
    return {
      ...blend,
      fillPriority: "radial-gradient",
      fillRadialGradientStartPoint: { x: cx, y: cy },
      fillRadialGradientEndPoint: { x: cx, y: cy },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: Math.max(node.width, node.height) / 2,
      fillRadialGradientColorStops: gradientColorStops(fill.stops),
    };
  }
  if (fill?.type === "image") {
    if (!image) return { ...blend, fill: "#e5e7eb" };
    const scaleX = node.width / image.width;
    const scaleY = node.height / image.height;
    const scale =
      fill.mode === "fit"
        ? Math.min(scaleX, scaleY)
        : fill.mode === "tile"
          ? 1
          : Math.max(scaleX, scaleY); // "fill" (cover) default
    return {
      ...blend,
      fillPriority: "pattern",
      fillPatternImage: image,
      fillPatternScaleX: scale,
      fillPatternScaleY: scale,
      fillPatternRepeat: fill.mode === "tile" ? "repeat" : "no-repeat",
    };
  }
  return { ...blend, fill: resolveFill(fill, ds, fallback) };
}
