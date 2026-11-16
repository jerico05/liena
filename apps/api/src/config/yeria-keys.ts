import fs from "node:fs";
import path from "node:path";
import { normalizePemKey } from "./normalize-pem";

const repositoryRoot = path.resolve(__dirname, "../../../..");

function resolveKeyPath(configuredPath: string): string {
  return path.isAbsolute(configuredPath) ? configuredPath : path.join(repositoryRoot, configuredPath);
}

export function readKeyFile(configuredPath: string | undefined): string | undefined {
  if (!configuredPath) return undefined;
  const absolutePath = resolveKeyPath(configuredPath);
  if (!fs.existsSync(absolutePath)) return undefined;
  const content = fs.readFileSync(absolutePath, "utf8").trim();
  if (content.length === 0) return undefined;
  return content.includes("-----BEGIN") ? normalizePemKey(content) : content;
}

export function resolveServicePrivateKey(input: {
  inlineKey?: string;
  keyPath?: string;
}): string | undefined {
  if (input.inlineKey?.trim()) return normalizePemKey(input.inlineKey);
  return readKeyFile(input.keyPath);
}

export function resolveServicePublicKey(input: {
  inlineKey?: string;
  keyPath?: string;
}): string | undefined {
  if (input.inlineKey?.trim()) return normalizePemKey(input.inlineKey);
  return readKeyFile(input.keyPath);
}
