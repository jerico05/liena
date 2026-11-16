import { createOpaqueToken, hashToken } from "./security-tokens";

const maxSessions = 50;

export type AdminSessionRecord = {
  id: string;
  tokenHash: string;
  csrfTokenHash: string;
  expiresAt: Date;
  lastSeenAt: Date;
  persistent: boolean;
};

const sessions = new Map<string, AdminSessionRecord>();

export function createAdminSession(input: {
  csrfTokenHash: string;
  expiresAt: Date;
  persistent: boolean;
}): { rawToken: string; session: AdminSessionRecord } {
  const rawToken = createOpaqueToken();
  const session: AdminSessionRecord = {
    id: createOpaqueToken(),
    tokenHash: hashToken(rawToken),
    csrfTokenHash: input.csrfTokenHash,
    expiresAt: input.expiresAt,
    lastSeenAt: new Date(),
    persistent: input.persistent,
  };
  sessions.set(session.tokenHash, session);
  purgeExpiredAdminSessions();
  trimSessions();
  return { rawToken, session };
}

export function findAdminSession(rawToken: string): AdminSessionRecord | undefined {
  const session = sessions.get(hashToken(rawToken));
  if (!session) return undefined;
  if (session.expiresAt.getTime() <= Date.now()) {
    sessions.delete(session.tokenHash);
    return undefined;
  }
  return session;
}

export function deleteAdminSession(sessionId: string): void {
  for (const [key, session] of sessions) {
    if (session.id === sessionId) sessions.delete(key);
  }
}

export function replaceSessionCsrf(sessionId: string, csrfTokenHash: string): void {
  for (const session of sessions.values()) {
    if (session.id === sessionId) session.csrfTokenHash = csrfTokenHash;
  }
}

export function touchAdminSession(session: AdminSessionRecord): void {
  if (session.lastSeenAt.getTime() < Date.now() - 10 * 60 * 1000) {
    session.lastSeenAt = new Date();
  }
}

export function purgeExpiredAdminSessions(): void {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (session.expiresAt.getTime() <= now) sessions.delete(key);
  }
}

function trimSessions(): void {
  if (sessions.size <= maxSessions) return;
  const oldest = [...sessions.values()].sort(
    (left, right) => left.lastSeenAt.getTime() - right.lastSeenAt.getTime(),
  );
  for (const session of oldest.slice(0, sessions.size - maxSessions)) {
    sessions.delete(session.tokenHash);
  }
}
