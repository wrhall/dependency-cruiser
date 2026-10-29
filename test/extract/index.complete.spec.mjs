import { deepEqual } from "node:assert/strict";
import { normalizeCruiseOptions } from "#main/options/normalize.mjs";
import normalizeResolveOptions from "#main/resolve-options/normalize.mjs";
import extract from "#extract/index.mjs";

describe("[I] extract/index - complete", () => {
  it("adds one module for each dependency that isn't followed, right after its first dependent", async () => {
    const lOptions = normalizeCruiseOptions({});
    const lResolveOptions = await normalizeResolveOptions(
      {
        bustTheCache: true,
      },
      lOptions,
    );
    const lResult = extract(
      ["./test/extract/__mocks__/complete/index.js"],
      lOptions,
      lResolveOptions,
    );

    deepEqual(
      lResult.map(({ source }) => source),
      [
        "test/extract/__mocks__/complete/index.js",
        "fs",
        "not-resolvable",
        "test/extract/__mocks__/complete/a.js",
        "path",
        "test/extract/__mocks__/complete/b.js",
      ],
    );
  });
});
