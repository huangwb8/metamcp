import {
  createToolName as createBackendToolName,
  parseToolName as parseBackendToolName,
} from "../../apps/backend/src/lib/metamcp/tool-name-parser";
import {
  createToolName as createFrontendToolName,
  parseToolName as parseFrontendToolName,
} from "../../apps/frontend/lib/tool-name-parser";

describe("MetaMCP tool name contract", () => {
  it.each([
    [
      "HackerNews__get_stories",
      { serverName: "HackerNews", originalToolName: "get_stories" },
    ],
    [
      "Parent__Child__search",
      { serverName: "Parent", originalToolName: "Child__search" },
    ],
    [
      "Server__tool__with__segments",
      { serverName: "Server", originalToolName: "tool__with__segments" },
    ],
  ])(
    "keeps frontend and backend parsing aligned for %s",
    (toolName, expected) => {
      expect(parseBackendToolName(toolName)).toEqual(expected);
      expect(parseFrontendToolName(toolName)).toEqual(expected);
    },
  );

  it("returns null in both runtimes when the forwarding separator is missing", () => {
    expect(parseBackendToolName("plainToolName")).toBeNull();
    expect(parseFrontendToolName("plainToolName")).toBeNull();
  });

  it("creates identical forwarded names in frontend and backend helpers", () => {
    expect(createBackendToolName("github", "search_repositories")).toBe(
      "github__search_repositories",
    );
    expect(createFrontendToolName("github", "search_repositories")).toBe(
      "github__search_repositories",
    );
  });
});
