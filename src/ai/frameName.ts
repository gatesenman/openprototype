/**
 * Derive a clean, human-friendly frame name from a requirement.
 * Prefers the markdown H1 heading; otherwise strips boilerplate prefixes
 * like "示例需求：" / "需求：" from the requirement title so generated frames
 * read as "登录页" rather than "示例需求：登录页".
 */
export function frameNameFromRequirement(title: string, markdown: string): string {
  const h1 = markdown
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("# "))
    ?.replace(/^#\s+/, "")
    .trim();
  if (h1) return h1;
  const stripped = title.replace(/^(示例需求|需求|示例|页面)[:：]\s*/, "").trim();
  return stripped || title;
}
