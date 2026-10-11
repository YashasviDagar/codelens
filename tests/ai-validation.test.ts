import { describe, it, expect } from "vitest";
import { parseUnifiedDiff } from "@codelens/analyzer";
import { validateAiFindings } from "@codelens/ai";
import { OpenAiReviewProvider, AiValidationError } from "@codelens/ai";
import type { AiReviewRequest, AiReviewResponse } from "@codelens/types";

const DIFF = `diff --git a/src/payment.ts b/src/payment.ts
--- a/src/payment.ts
+++ b/src/payment.ts
@@ -10,3 +10,4 @@
 existing();
+  await db.getUser(u.id);
 return result;`;

const REQ: AiReviewRequest = {
  repositoryLanguage: "typescript",
  prTitle: "test pr",
  prDescription: "",
  files: [
    {
      path: "src/payment.ts",
      language: "typescript",
      diffContent: DIFF,
      snippets: [{ symbolName: "charge", startLine: 10, code: "existing();\nawait db.getUser(u.id);\nreturn result;" }],
    },
  ],
  staticFindings: [],
  testsTouched: false,
};

const validFiles = new Map([["src/payment.ts", new Set([11])]]);

function makeCtx(_findings: AiReviewResponse["findings"]) {
  return { request: REQ, validFiles, staticFindingKeys: new Set<string>() };
}

describe("hallucination guards", () => {
  it("accepts a valid anchored finding", () => {
    const res = validateAiFindings(
      {
        summary: "s",
        findings: [
          {
            file: "src/payment.ts",
            line: 11,
            severity: "high",
            category: "bug",
            title: "Missing error handling",
            description: "d",
            evidence: "await db.getUser(u.id)",
            recommendation: "r",
            confidence: 0.9,
          },
        ],
      },
      makeCtx([] as any)
    );
    expect(res.findings).toHaveLength(1);
    expect(res.rejected).toHaveLength(0);
  });

  it("rejects hallucinated file", () => {
    const res = validateAiFindings(
      {
        summary: "s",
        findings: [
          { file: "src/nonexistent.ts", line: 5, severity: "low", category: "bug", title: "t", description: "d", evidence: "x", recommendation: "r", confidence: 0.9 },
        ],
      },
      makeCtx([] as any)
    );
    expect(res.findings).toHaveLength(0);
    expect(res.rejected[0].reason).toBe("hallucinated file");
  });

  it("rejects invalid line numbers", () => {
    const res = validateAiFindings(
      {
        summary: "s",
        findings: [
          { file: "src/payment.ts", line: 999, severity: "low", category: "bug", title: "t", description: "d", evidence: "x", recommendation: "r", confidence: 0.9 },
        ],
      },
      makeCtx([] as any)
    );
    expect(res.findings).toHaveLength(0);
  });

  it("rejects fabricated evidence", () => {
    const res = validateAiFindings(
      {
        summary: "s",
        findings: [
          { file: "src/payment.ts", line: 11, severity: "low", category: "bug", title: "t", description: "d", evidence: "definitely not in the file", recommendation: "r", confidence: 0.9 },
        ],
      },
      makeCtx([] as any)
    );
    expect(res.findings).toHaveLength(0);
  });

  it("clamps severity to MEDIUM without corroboration", () => {
    const res = validateAiFindings(
      {
        summary: "s",
        findings: [
          { file: "src/payment.ts", line: 11, severity: "critical", category: "bug", title: "t", description: "d", evidence: "await db.getUser(u.id)", recommendation: "r", confidence: 0.9 },
        ],
      },
      makeCtx([] as any)
    );
    expect(res.findings[0].severity).toBe("MEDIUM");
  });

  it("drops duplicate findings", () => {
    const f = { file: "src/payment.ts", line: 11, severity: "low" as const, category: "bug" as const, title: "same title same title same title", description: "d", evidence: "await db.getUser(u.id)", recommendation: "r", confidence: 0.9 };
    const res = validateAiFindings({ summary: "s", findings: [f, { ...f }] }, makeCtx([] as any));
    expect(res.findings).toHaveLength(1);
    expect(res.rejected[0].reason).toBe("duplicate AI finding");
  });
});

describe("OpenAI provider response parsing", () => {
  function providerWith(fetchImpl: any) {
    return new OpenAiReviewProvider({ apiKey: "test", fetchImpl });
  }

  it("parses valid JSON response", async () => {
    const ok = {
      summary: "ok",
      findings: [],
    };
    const p = providerWith(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(ok) } }] }), { status: 200 }));
    const res = await p.generateReview(REQ);
    expect(res.summary).toBe("ok");
  });

  it("throws on malformed JSON", async () => {
    const p = providerWith(async () => new Response(JSON.stringify({ choices: [{ message: { content: "not json at all" } }] }), { status: 200 }));
    await expect(p.generateReview(REQ)).rejects.toBeInstanceOf(AiValidationError);
  });

  it("throws on schema-invalid JSON", async () => {
    const p = providerWith(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: "s", findings: [{ only: "junk" }] }) } }] }), { status: 200 })
    );
    await expect(p.generateReview(REQ)).rejects.toBeInstanceOf(AiValidationError);
  });
});

describe("diff parser (extra)", () => {
  it("handles new files", () => {
    const d = parseUnifiedDiff(`diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+a
+b`);
    expect(d.files[0].status).toBe("added");
    expect(d.files[0].additions).toBe(2);
  });
});
