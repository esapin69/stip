import { createServer } from "node:http";
import { handleRequest } from "./handler.mjs";

const port = Number(process.env.PORT || 10000);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error("Invalid PORT");
}

createServer(handleRequest).listen(port, "0.0.0.0", () => {
  console.log("GHE Render bridge listening in standby mode");
});
