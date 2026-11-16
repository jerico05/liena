import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createApp } from "../src/app";

const app = createApp();
let server: ReturnType<typeof app.listen>;
let baseUrl: string;

const paths = [
  "/screens/home",
  "/screens/map",
  "/map",
  "/screens/home/map",
  "/screens/categories",
  "/screens/categories/cat-1",
  "/screens/categories/1",
  "/screens/categories/cat-1/service-1",
  "/screens/categories/cat-1/service-1/provider-1",
  "/screens/home/browse/cat-1",
  "/screens/home/browse/cat-1/service-1",
  "/screens/home/search/services/service-1",
  "/browse",
  "/browse/cat-1/service-1",
  "/cat-1",
  "/cat-8",
  "/cat-3/service-1",
];

test("Yeria screen paths must not return HTTP 404", async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });

  for (const path of paths) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.notEqual(response.status, 404, `${path} returned 404`);
  }
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});