/** Découpe le champ texte `services` des prestataires en libellés distincts. */
export function parseServiceOfferings(text: string): string[] {
  return text
    .split(/[,;\n·|]+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 2 && part.length <= 120);
}

export function dedupeServiceLabels(labels: Iterable<string>): string[] {
  const seen = new Map<string, string>();
  for (const raw of labels) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("fr");
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "fr"));
}