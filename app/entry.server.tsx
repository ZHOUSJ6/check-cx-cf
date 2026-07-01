/**
 * Custom server entry — required on Cloudflare Workers because the default
 * @react-router/node entry uses renderToPipeableStream (Node-only). Workers
 * provide renderToReadableStream instead.
 *
 * Adapted from the create-cloudflare react-router template.
 */

import { renderToReadableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import type { EntryContext } from "react-router";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        responseStatusCode = 500;
        if (shellRendered) {
          console.error(error);
        }
      },
    },
  );
  shellRendered = true;

  // Wait for all content to load before responding for bots / SPA renders.
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
