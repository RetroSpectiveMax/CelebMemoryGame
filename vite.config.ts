import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const toQueryObject = (requestUrl: string | undefined) => {
  const url = new URL(requestUrl ?? "", "http://localhost");
  const query: Record<string, string | string[]> = {};

  url.searchParams.forEach((value, key) => {
    const existingValue = query[key];

    if (!existingValue) {
      query[key] = value;
      return;
    }

    query[key] = Array.isArray(existingValue) ? [...existingValue, value] : [existingValue, value];
  });

  return query;
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-celebrity-api",
      configureServer(server) {
        server.middlewares.use("/api/celebrities", async (request, response) => {
          const { default: handler } = await import("./api/celebrities");
          const requestUrl = "url" in request && typeof request.url === "string" ? request.url : "";
          const requestAdapter = Object.assign(request, {
            query: toQueryObject(requestUrl),
          }) as unknown as VercelRequest;
          const responseAdapter = {
            setHeader: (name: string, value: number | string | readonly string[]) => {
              response.setHeader(name, value);
              return responseAdapter;
            },
            status: (statusCode: number) => {
              response.statusCode = statusCode;
              return responseAdapter;
            },
            json: (body: unknown) => {
              if (!response.hasHeader("Content-Type")) {
                response.setHeader("Content-Type", "application/json");
              }

              response.end(JSON.stringify(body));
              return responseAdapter;
            },
          } as unknown as VercelResponse;

          await handler(requestAdapter, responseAdapter);
        });
      },
    },
  ],
});
