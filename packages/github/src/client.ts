import { githubHeaders } from "./oauth.js";

const API = "https://api.github.com";

export class GitHubApiClient {
  constructor(private token: string) {}

  async listUserRepositories(page = 1): Promise<Array<{ id: number; name: string; full_name: string; owner: { login: string }; default_branch: string; private: boolean; language: string | null }>> {
    const res = await fetch(`${API}/user/repos?per_page=100&page=${page}&sort=updated`, {
      headers: githubHeaders(this.token),
    });
    if (!res.ok) throw new Error(`listUserRepositories failed: ${res.status}`);
    return res.json() as any;
  }

  async getPullRequest(owner: string, repo: string, prNumber: number) {
    const res = await fetch(`${API}/repos/${owner}/${repo}/pulls/${prNumber}`, {
      headers: githubHeaders(this.token),
    });
    if (!res.ok) throw new Error(`getPullRequest failed: ${res.status}`);
    return res.json() as any;
  }

  async listPullRequestFiles(owner: string, repo: string, prNumber: number): Promise<Array<{ filename: string; previous_filename?: string; status: string; additions: number; deletions: number; patch?: string }>> {
    const files: any[] = [];
    let page = 1;
    while (true) {
      const res = await fetch(`${API}/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`, {
        headers: githubHeaders(this.token),
      });
      if (!res.ok) throw new Error(`listPullRequestFiles failed: ${res.status}`);
      const batch = (await res.json()) as any[];
      files.push(...batch);
      if (batch.length < 100) break;
      page++;
    }
    return files;
  }

  /**
   * Fetches the PR diff as unified diff text.
   */
  async getPullRequestDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    const res = await fetch(`${API}/repos/${owner}/${repo}/pulls/${prNumber}`, {
      headers: { ...githubHeaders(this.token), Accept: "application/vnd.github.v3.diff" },
    });
    if (!res.ok) throw new Error(`getPullRequestDiff failed: ${res.status}`);
    return res.text();
  }

  async getFileContent(owner: string, repo: string, path: string, ref: string): Promise<string | null> {
    const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`, {
      headers: githubHeaders(this.token),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    if (json.encoding !== "base64") return null;
    return Buffer.from(json.content, "base64").toString("utf-8");
  }

  /**
   * Creates PR file review comments. Only used for validated findings.
   */
  async createInlineComment(owner: string, repo: string, prNumber: number, body: string, commitSha: string, path: string, line: number) {
    const res = await fetch(`${API}/repos/${owner}/${repo}/pulls/${prNumber}/comments`, {
      method: "POST",
      headers: githubHeaders(this.token),
      body: JSON.stringify({ body, commit_id: commitSha, path, line, side: "RIGHT" }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`createInlineComment failed: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  async createIssueComment(owner: string, repo: string, prNumber: number, body: string) {
    const res = await fetch(`${API}/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
      method: "POST",
      headers: githubHeaders(this.token),
      body: JSON.stringify({ body }),
    });
    if (!res.ok) throw new Error(`createIssueComment failed: ${res.status}`);
    return res.json();
  }
}
