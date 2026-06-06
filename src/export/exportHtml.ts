import { DesignSystem, Frame, GpoDocument, Node } from "@/schema/types";
import { nodeFill, resolveFill } from "@/render/resolve";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nodeHtml(node: Node, ds: DesignSystem): string {
  const s = node.style;
  const styles: string[] = [
    "position:absolute",
    `left:${node.x}px`,
    `top:${node.y}px`,
    `width:${node.width}px`,
    `height:${node.height}px`,
  ];
  if (node.type === "image" && node.src) {
    styles.push(
      `background-image:url('${node.src}')`,
      "background-size:cover",
      "background-position:center",
    );
  } else if (node.type !== "text") {
    styles.push(`background:${nodeFill(node, ds)}`);
  }
  if (s.radius) styles.push(`border-radius:${s.radius}px`);
  if (s.stroke) styles.push(`border:${s.stroke.width}px solid ${s.stroke.color}`);
  if (s.opacity !== undefined) styles.push(`opacity:${s.opacity}`);
  if (s.shadow)
    styles.push(
      `box-shadow:${s.shadow.x}px ${s.shadow.y}px ${s.shadow.blur}px ${s.shadow.color}`,
    );

  let inner = "";
  if (node.text) {
    const t = node.text;
    const align =
      t.align === "center" ? "center" : t.align === "right" ? "flex-end" : "flex-start";
    const just = node.type === "button" ? "center" : align;
    styles.push(
      "display:flex",
      "align-items:center",
      `justify-content:${node.type === "button" ? "center" : align}`,
      `color:${t.color}`,
      `font-size:${t.fontSize}px`,
      `font-weight:${t.fontWeight}`,
      `font-family:${t.fontFamily}`,
      `line-height:${t.lineHeight}`,
      `text-align:${t.align}`,
    );
    void just;
    inner = esc(t.content);
  }

  const click = node.interactions?.find((i) => i.trigger === "click");
  const onclick = click
    ? ` onclick="gotoFrame('${click.targetFrameId}', '${click.animation ?? "none"}')" data-clickable="1"`
    : "";

  const children = (node.children ?? []).map((c) => nodeHtml(c, ds)).join("");
  return `<div style="${styles.join(";")}"${onclick}>${inner}${children}</div>`;
}

function frameHtml(frame: Frame, ds: DesignSystem, isFirst: boolean): string {
  const bg = frame.background || resolveFill(undefined, ds, "#fff");
  return `<div class="frame${isFirst ? " active" : ""}" id="frame-${frame.id}" style="width:${frame.width}px;height:${frame.height}px;background:${bg}">
    ${frame.nodes.map((n) => nodeHtml(n, ds)).join("\n")}
  </div>`;
}

export function exportToHtml(doc: GpoDocument): string {
  const frames = doc.pages.flatMap((p) => p.frames);
  if (frames.length === 0) return "<!doctype html><title>空原型</title><p>没有可导出的页面</p>";
  const ds = doc.designSystem;
  const w = frames[0].width;
  const h = frames[0].height;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(doc.meta.name)} · 原型演示</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0b1220;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Inter,system-ui,"PingFang SC",sans-serif}
  .device{position:relative;border-radius:28px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.55);width:${w}px;height:${h}px}
  .frame{position:absolute;inset:0;display:none;overflow:hidden}
  .frame.active{display:block}
  [data-clickable]{cursor:pointer}
  .hint{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);color:#64748b;font-size:12px}
  @keyframes fade{from{opacity:0}to{opacity:1}}
  @keyframes sl{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
  @keyframes slr{from{transform:translateX(-40px);opacity:0}to{transform:none;opacity:1}}
  .anim-fade{animation:fade .25s ease}
  .anim-slide-left{animation:sl .25s ease}
  .anim-slide-right{animation:slr .25s ease}
</style>
</head>
<body>
  <div class="device">
    ${frames.map((f, i) => frameHtml(f, ds, i === 0)).join("\n")}
  </div>
  <div class="hint">点击可交互元素进行原型跳转 · 由 OpenPrototype 导出</div>
<script>
  function gotoFrame(id, anim){
    document.querySelectorAll('.frame').forEach(function(f){
      f.classList.remove('active','anim-fade','anim-slide-left','anim-slide-right');
    });
    var target=document.getElementById('frame-'+id);
    if(!target) return;
    target.classList.add('active');
    if(anim && anim!=='none') target.classList.add('anim-'+anim);
  }
</script>
</body>
</html>`;
}

export function downloadHtml(doc: GpoDocument): void {
  const html = exportToHtml(doc);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.meta.name || "prototype"}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
