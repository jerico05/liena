/**
 * Répare les PEM collés en une ligne dans Netlify (`\n` littéraux ou tout sur une seule ligne).
 * OpenSSL / le SDK Yeria exigent des retours à la ligne autour du corps base64.
 */
export function normalizePemKey(value: string): string {
  let pem = value.trim().replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!pem.includes("-----BEGIN")) return pem;

  const beginMatch = pem.match(/-----BEGIN [^-]+-----/);
  const endMatch = pem.match(/-----END [^-]+-----/);
  if (!beginMatch || !endMatch) return pem;

  const begin = beginMatch[0];
  const end = endMatch[0];
  const bodyStart = beginMatch.index! + begin.length;
  const bodyEnd = pem.indexOf(end, bodyStart);
  if (bodyEnd < 0) return pem;

  const body = pem.slice(bodyStart, bodyEnd).replace(/\s+/g, "");
  if (!body) return pem;

  return `${begin}\n${body}\n${end}\n`;
}