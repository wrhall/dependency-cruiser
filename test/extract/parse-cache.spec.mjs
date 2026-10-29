import { equal, notEqual } from "node:assert/strict";
import { join } from "node:path";
import * as acorn from "#extract/acorn/parse.mjs";
import * as swc from "#extract/swc/parse.mjs";
import * as tsc from "#extract/tsc/parse.mjs";

const MOCKS = join(import.meta.dirname, "swc", "__mocks__");
const FILE_A = join(MOCKS, "javascript.js");
const FILE_B = join(MOCKS, "typescript.ts");

for (const [lName, lParser] of Object.entries({ acorn, swc, tsc })) {
  describe(`[U] extract/${lName}/parse - AST cache`, () => {
    beforeEach(() => {
      lParser.clearCache();
    });
    afterEach(() => {
      lParser.clearCache();
    });

    it("returns the cached AST for repeated calls on the same file", () => {
      equal(lParser.getASTCached(FILE_A), lParser.getASTCached(FILE_A));
    });

    it("only keeps the AST of the most recently parsed file", () => {
      const lFirstAST = lParser.getASTCached(FILE_A);

      lParser.getASTCached(FILE_B);

      notEqual(lParser.getASTCached(FILE_A), lFirstAST);
    });
  });
}
