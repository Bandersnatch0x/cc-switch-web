import { describe, expect, it } from "vitest";
import { formatJSON, formatMcpJSON } from "@/utils/formatters";

describe("formatJSON", () => {
  it("preserves root env object", () => {
    const input = '{"env":{"A":"1"}}';
    expect(formatJSON(input)).toBe('{\n  "env": {\n    "A": "1"\n  }\n}');
  });

  it("does not unwrap single-key root object", () => {
    const input = '{"my-server":{"command":"npx"}}';
    expect(formatJSON(input)).toBe(
      '{\n  "my-server": {\n    "command": "npx"\n  }\n}',
    );
  });
});

describe("formatMcpJSON", () => {
  it("unwraps MCP wrapped shape and returns inner config", () => {
    const input = '{"my-server":{"command":"npx"}}';
    expect(formatMcpJSON(input)).toBe('{\n  "command": "npx"\n}');
  });

  it("supports fragment input with single-key wrapper", () => {
    const input = '"my-server": {"command":"npx"}';
    expect(formatMcpJSON(input)).toBe('{\n  "command": "npx"\n}');
  });
});
