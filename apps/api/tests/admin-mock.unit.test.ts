import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { listMockProviders, reviewMockProvider, resetMockProviders } from "../src/services/admin-provider.mock-store";

describe("admin provider mock store", () => {
  test("lists seeded providers with summary and pagination", () => {
    resetMockProviders();
    const result = listMockProviders({ page: 1, pageSize: 5 });
    assert.ok(result.data.length > 0);
    assert.ok(result.pagination.total >= result.data.length);
    assert.ok(result.summary.pending >= 0);
  });

  test("reviews a pending provider", () => {
    resetMockProviders();
    const pending = listMockProviders({ status: "PENDING", page: 1, pageSize: 1 });
    const target = pending.data[0];
    assert.ok(target);
    const updated = reviewMockProvider(target.id, "VERIFY", "OK");
    assert.equal(updated.status, "VERIFIED");
  });
});
