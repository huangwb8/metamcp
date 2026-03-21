import {
  compose,
  createFunctionalMiddleware,
  MetaMCPHandlerContext,
} from "../../apps/backend/src/lib/metamcp/metamcp-middleware/functional-middleware";

describe("functional MetaMCP middleware contract", () => {
  const context: MetaMCPHandlerContext = {
    namespaceUuid: "namespace-1",
    sessionId: "session-1",
  };

  it("transforms requests before the handler and responses after the handler", async () => {
    const handler = vi.fn(
      async (
        request: { toolName: string; suffix: string },
        handlerContext: MetaMCPHandlerContext,
      ) => ({
        result: `${request.toolName}:${handlerContext.sessionId}`,
      }),
    );

    const middleware = createFunctionalMiddleware<
      { toolName: string; suffix: string },
      { result: string }
    >({
      transformRequest: (request, handlerContext) => ({
        ...request,
        toolName: `${request.toolName}:${handlerContext.namespaceUuid}`,
      }),
      transformResponse: (response, handlerContext) => ({
        result: `${response.result}:${handlerContext.namespaceUuid}`,
      }),
    });

    const wrapped = middleware(handler);
    const response = await wrapped(
      { toolName: "github__search", suffix: "ignored" },
      context,
    );

    expect(handler).toHaveBeenCalledWith(
      {
        toolName: "github__search:namespace-1",
        suffix: "ignored",
      },
      context,
    );
    expect(response).toEqual({
      result: "github__search:namespace-1:session-1:namespace-1",
    });
  });

  it("composes middleware from right to left while preserving before/after order", async () => {
    const events: string[] = [];

    const baseHandler = async (value: string) => {
      events.push(`handler:${value}`);
      return `${value}:handled`;
    };

    const firstMiddleware = (handler: typeof baseHandler) => {
      return async (value: string) => {
        events.push(`first:before:${value}`);
        const result = await handler(`${value}:first`);
        events.push(`first:after:${result}`);
        return `${result}:first`;
      };
    };

    const secondMiddleware = (handler: typeof baseHandler) => {
      return async (value: string) => {
        events.push(`second:before:${value}`);
        const result = await handler(`${value}:second`);
        events.push(`second:after:${result}`);
        return `${result}:second`;
      };
    };

    const wrapped = compose(firstMiddleware, secondMiddleware)(baseHandler);
    const result = await wrapped("start");

    expect(result).toBe("start:first:second:handled:second:first");
    expect(events).toEqual([
      "first:before:start",
      "second:before:start:first",
      "handler:start:first:second",
      "second:after:start:first:second:handled",
      "first:after:start:first:second:handled:second",
    ]);
  });
});
