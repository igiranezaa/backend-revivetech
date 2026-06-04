declare module "cloudflare:node" {
  import type { Server } from "node:http";

  type ServerHandlerOptions = {
    port: number;
  };

  export function httpServerHandler(server: Server): ExportedHandler;
  export function httpServerHandler(options: ServerHandlerOptions): ExportedHandler;
}
