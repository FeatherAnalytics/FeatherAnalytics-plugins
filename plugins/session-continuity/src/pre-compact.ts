import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { parseTranscript, generateAutoHandoff } from './transcript-parser.js';

interface PreCompactInput {
  trigger: 'manual' | 'auto';
  session_id: string;
  transcript_path: string;
  custom_instructions?: string;
}

interface HookOutput {
  result: 'continue' | 'block';
  message?: string;
}

async function main() {
  const input: PreCompactInput = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Find existing checkpoint files
  const checkpointDir = path.join(projectDir, 'thoughts', 'checkpoints');
  let checkpointFiles: string[] = [];
  try {
    checkpointFiles = fs.readdirSync(checkpointDir)
      .filter(f => f.startsWith('CHECKPOINT-') && f.endsWith('.md'));
  } catch {
    // checkpoint directory may not exist
  }

  if (checkpointFiles.length === 0) {
    // No checkpoint - just remind to create one
    const output: HookOutput = {
      result: 'continue',
      message: '[PreCompact] No checkpoint found. Create one? /checkpoint'
    };
    console.log(JSON.stringify(output));
    return;
  }

  // Get most recent checkpoint
  const mostRecent = checkpointFiles.sort((a, b) => {
    const statA = fs.statSync(path.join(checkpointDir, a));
    const statB = fs.statSync(path.join(checkpointDir, b));
    return statB.mtime.getTime() - statA.mtime.getTime();
  })[0];

  const checkpointPath = path.join(checkpointDir, mostRecent);

  if (input.trigger === 'auto') {
    // Auto-compact: Use transcript parser to generate full handoff
    const sessionName = mostRecent.replace('CHECKPOINT-', '').replace('.md', '');
    let handoffFile = '';

    if (input.transcript_path && fs.existsSync(input.transcript_path)) {
      // Parse transcript and generate handoff
      const summary = parseTranscript(input.transcript_path);

      // Get current git branch
      let branch = 'unknown';
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: projectDir,
          encoding: 'utf-8',
          timeout: 3000
        }).trim();
      } catch {}

      const handoffContent = generateAutoHandoff(summary, sessionName, branch);

      // Ensure thoughts/ is in .git/info/exclude before writing
      const excludePath = path.join(projectDir, '.git', 'info', 'exclude');
      try {
        const exclude = fs.readFileSync(excludePath, 'utf-8');
        if (!exclude.includes('thoughts/')) {
          fs.appendFileSync(excludePath, '\nthoughts/\n');
        }
      } catch {}

      // Ensure handoff directory exists (thoughts/shared/handoffs is tracked in git)
      const handoffDir = path.join(projectDir, 'thoughts', 'shared', 'handoffs', sessionName);
      fs.mkdirSync(handoffDir, { recursive: true });

      // Write handoff with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      handoffFile = `auto-handoff-${timestamp}.md`;
      const handoffPath = path.join(handoffDir, handoffFile);
      fs.writeFileSync(handoffPath, handoffContent);

      // Also append brief summary to checkpoint for visibility
      const briefSummary = generateAutoSummary(projectDir);
      if (briefSummary) {
        appendToCheckpoint(checkpointPath, briefSummary);
      }
    } else {
      // Fallback: no transcript, use legacy summary
      const briefSummary = generateAutoSummary(projectDir);
      if (briefSummary) {
        appendToCheckpoint(checkpointPath, briefSummary);
      }
    }

    const message = handoffFile
      ? `[PreCompact:auto] Created ${handoffFile} in thoughts/shared/handoffs/${sessionName}/`
      : `[PreCompact:auto] Session summary auto-appended to ${mostRecent}`;

    const output: HookOutput = {
      result: 'continue',
      message: message
    };
    console.log(JSON.stringify(output));
  } else {
    // Manual compact: warn user (cannot block, just inform)
    const output: HookOutput = {
      result: 'continue',
      message: `[PreCompact] Consider updating checkpoint before compacting: /checkpoint\nCheckpoint: ${mostRecent}`
    };
    console.log(JSON.stringify(output));
  }
}

function generateAutoSummary(projectDir: string): string | null {
  const lines: string[] = [];
  const timestamp = new Date().toISOString();

  // Use git diff --stat for files changed
  try {
    const diffStat = execSync('git diff --stat HEAD', {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 5000
    }).trim();
    if (diffStat) lines.push(`- Uncommitted changes:\n${diffStat}`);
  } catch {}

  // Use git log for recent commits
  try {
    const recentCommits = execSync('git log --oneline -5', {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 5000
    }).trim();
    if (recentCommits) lines.push(`- Recent commits:\n${recentCommits}`);
  } catch {}

  if (lines.length === 0) return null;
  return `\n## Session Auto-Summary (${timestamp})\n${lines.join('\n')}`;
}

function appendToCheckpoint(checkpointPath: string, summary: string): void {
  try {
    let content = fs.readFileSync(checkpointPath, 'utf-8');

    // Find the "## State" section and append after "Done:" items
    const stateMatch = content.match(/## State\n/);
    if (stateMatch) {
      // Find end of Done section (before "- Now:" or "- Next:")
      const nowMatch = content.match(/(\n-\s*Now:)/);
      if (nowMatch && nowMatch.index) {
        // Insert summary before "Now:"
        content = content.slice(0, nowMatch.index) + summary + content.slice(nowMatch.index);
      } else {
        // Just append to end of State section
        const nextSection = content.indexOf('\n## ', content.indexOf('## State') + 1);
        if (nextSection > 0) {
          content = content.slice(0, nextSection) + summary + '\n' + content.slice(nextSection);
        } else {
          content += summary;
        }
      }
    } else {
      // No State section, append to end
      content += summary;
    }

    fs.writeFileSync(checkpointPath, content);
  } catch {
    // Silently fail - don't break compact
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

main().catch(console.error);
