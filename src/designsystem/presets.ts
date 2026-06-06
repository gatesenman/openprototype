import { DesignTokens, Variable } from "@/schema/types";
import { id } from "@/schema/defaults";

/**
 * 预置（内置）设计系统。
 *
 * 每个预置提供一套完整、标准化的 design tokens（色板 / 字阶 / 圆角 / 间距 /
 * 阴影），对标业界常见设计语言。用户可在「设计系统」弹窗里一键套用，新文件
 * 也默认带上这些预置可供切换。
 */
export interface DesignSystemPreset {
  id: string;
  name: string;
  description: string;
  tokens: DesignTokens;
  /** 套用预置时一并写入的变量（颜色/数值）。 */
  variables: () => Variable[];
}

const baseFontSizes = { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, "2xl": 36 };

export const DESIGN_SYSTEM_PRESETS: DesignSystemPreset[] = [
  {
    id: "preset_default",
    name: "OpenPrototype 默认",
    description: "中性、克制的默认设计系统（靛蓝主色）。",
    tokens: {
      colors: {
        primary: "#4f46e5",
        "primary-fg": "#ffffff",
        bg: "#ffffff",
        surface: "#f8fafc",
        border: "#e2e8f0",
        text: "#0f172a",
        muted: "#64748b",
        success: "#16a34a",
        danger: "#dc2626",
      },
      fonts: { family: "Inter, system-ui, sans-serif", sizes: baseFontSizes },
      radii: { sm: 4, md: 8, lg: 16, full: 999 },
      spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
      elevation: {
        sm: { x: 0, y: 1, blur: 2, color: "rgba(15,23,42,0.08)" },
        md: { x: 0, y: 4, blur: 12, color: "rgba(15,23,42,0.12)" },
        lg: { x: 0, y: 12, blur: 32, color: "rgba(15,23,42,0.16)" },
      },
    },
    variables: () => [
      { id: id("var"), name: "brand/primary", type: "color", value: "#4f46e5", collection: "Brand" },
      { id: id("var"), name: "brand/accent", type: "color", value: "#0ea5e9", collection: "Brand" },
    ],
  },
  {
    id: "preset_material",
    name: "Material 3",
    description: "Google Material Design 3 风格（紫色主色、较大圆角）。",
    tokens: {
      colors: {
        primary: "#6750a4",
        "primary-fg": "#ffffff",
        bg: "#fffbfe",
        surface: "#f3edf7",
        border: "#cac4d0",
        text: "#1c1b1f",
        muted: "#49454f",
        success: "#386a20",
        danger: "#b3261e",
      },
      fonts: { family: "Roboto, system-ui, sans-serif", sizes: baseFontSizes },
      radii: { sm: 8, md: 12, lg: 24, full: 999 },
      spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
      elevation: {
        sm: { x: 0, y: 1, blur: 3, color: "rgba(0,0,0,0.15)" },
        md: { x: 0, y: 2, blur: 6, color: "rgba(0,0,0,0.18)" },
        lg: { x: 0, y: 6, blur: 12, color: "rgba(0,0,0,0.22)" },
      },
    },
    variables: () => [
      { id: id("var"), name: "md/primary", type: "color", value: "#6750a4", collection: "Material" },
      { id: id("var"), name: "md/tertiary", type: "color", value: "#7d5260", collection: "Material" },
    ],
  },
  {
    id: "preset_ant",
    name: "Ant Design",
    description: "Ant Design 风格（拂晓蓝主色、2px 圆角）。",
    tokens: {
      colors: {
        primary: "#1677ff",
        "primary-fg": "#ffffff",
        bg: "#ffffff",
        surface: "#fafafa",
        border: "#d9d9d9",
        text: "#000000d9",
        muted: "#00000073",
        success: "#52c41a",
        danger: "#ff4d4f",
      },
      fonts: { family: "-apple-system, 'Segoe UI', Roboto, sans-serif", sizes: baseFontSizes },
      radii: { sm: 2, md: 6, lg: 8, full: 999 },
      spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
      elevation: {
        sm: { x: 0, y: 1, blur: 2, color: "rgba(0,0,0,0.06)" },
        md: { x: 0, y: 6, blur: 16, color: "rgba(0,0,0,0.08)" },
        lg: { x: 0, y: 9, blur: 28, color: "rgba(0,0,0,0.12)" },
      },
    },
    variables: () => [
      { id: id("var"), name: "ant/primary", type: "color", value: "#1677ff", collection: "Ant" },
      { id: id("var"), name: "ant/warning", type: "color", value: "#faad14", collection: "Ant" },
    ],
  },
  {
    id: "preset_element_plus",
    name: "Element Plus",
    description: "Element Plus 风格（活力蓝主色、4px 圆角）。",
    tokens: {
      colors: {
        primary: "#409eff",
        "primary-fg": "#ffffff",
        bg: "#ffffff",
        surface: "#f5f7fa",
        border: "#dcdfe6",
        text: "#303133",
        muted: "#909399",
        success: "#67c23a",
        danger: "#f56c6c",
      },
      fonts: { family: "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif", sizes: baseFontSizes },
      radii: { sm: 2, md: 4, lg: 8, full: 999 },
      spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
      elevation: {
        sm: { x: 0, y: 0, blur: 12, color: "rgba(0,0,0,0.12)" },
        md: { x: 0, y: 2, blur: 12, color: "rgba(0,0,0,0.12)" },
        lg: { x: 0, y: 12, blur: 32, color: "rgba(0,0,0,0.18)" },
      },
    },
    variables: () => [
      { id: id("var"), name: "ep/primary", type: "color", value: "#409eff", collection: "Element Plus" },
      { id: id("var"), name: "ep/warning", type: "color", value: "#e6a23c", collection: "Element Plus" },
    ],
  },
];

export function findPreset(presetId: string): DesignSystemPreset | undefined {
  return DESIGN_SYSTEM_PRESETS.find((p) => p.id === presetId);
}
