import { execSync } from "child_process";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

const tokens = process.env.CLAUDE_CONTEXT_TOKENS ?? "";
const pct = process.env.CLAUDE_CONTEXT_PERCENT ?? "";

const branch = run("git rev-parse --abbrev-ref HEAD") || "?";
const dirty = run("git status --porcelain").split("\n").filter(Boolean).length;

let gitSeg = branch;
if (dirty > 0) gitSeg += ` U:${dirty}`;

let checkpointSeg = "";
try {
  const dir = "thoughts/checkpoints";
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("CHECKPOINT-") && f.endsWith(".md"))
    .sort()
    .reverse();

  if (files.length > 0) {
    const content = readFileSync(join(dir, files[0]), "utf-8");
    const lines = content.split("\n");

    const doneLines = lines.filter((l) => /^\s*- \[x\]/.test(l));
    const lastDone = doneLines.length > 0
      ? doneLines[doneLines.length - 1].replace(/.*\[x\]\s*/, "")
      : "";

    const nowLine = lines.find((l) => /^\s*- Now:/.test(l));
    const now = nowLine ? nowLine.replace(/.*- Now:\s*/, "") : "";

    if (lastDone && now) {
      checkpointSeg = `done:${lastDone.slice(0, 30)} now:${now.slice(0, 40)}`;
    } else if (now) {
      checkpointSeg = now.slice(0, 50);
    }
  }
} catch {
  // no checkpoint directory
}

let out = "";
if (tokens) out += tokens;
if (pct) out += ` ${pct}%`;
out += ` | ${gitSeg}`;
if (checkpointSeg) out += ` | ${checkpointSeg}`;

console.log(out);
