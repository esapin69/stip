/**
 * GHE Render bridge — initial standby contract.
 * No tasks, credentials, databases, or user data are connected.
 * All non-health requests are denied.
 */
export const bridgeStatus = Object.freeze({
  service: "ghe-render-bridge",
  status: "standby",
  tasks_enabled: false,
  connected_to_ghe: false,
  data_access_enabled: false
});

export function handleRequest(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  const path = (request.url || "/").split("?")[0];
  if (request.method === "GET" && path === "/health") {
    response.writeHead(200);
    response.end(JSON.stringify(bridgeStatus));
    return;
  }

  response.writeHead(404);
  response.end(JSON.stringify({ error: "not_found" }));
}
