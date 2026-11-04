export function withAdminMockMeta<T extends Record<string, unknown>>(payload: T): T & { meta: { source: "mock" } } {
  return { ...payload, meta: { source: "mock" } };
}
