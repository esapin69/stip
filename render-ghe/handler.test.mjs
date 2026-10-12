import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { handleRequest } from "./handler.mjs";

test("health endpoint is safe and in standby", async () => {
  const server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const origin = `http://127.0.0.1:${port}`;
    const res = await fetch(`${origin}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.service, "ghe-render-bridge");
    assert.equal(body.status, "standby");
    assert.equal(body.tasks_enabled, false);
    assert.equal(body.connected_to_ghe, false);
    assert.equal(body.data_access_enabled, false);

    const denied = await fetch(`${origin}/execute`, { method: "POST" });
    assert.equal(denied.status, 404);
    const unknown = await fetch(`${origin}/anything`);
    assert.equal(unknown.status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
