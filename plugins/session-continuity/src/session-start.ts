import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface SessionStartInput {
  type?: 'startup' | 'resume' | 'clear' | 'compact';  // Legacy field
  source?: 'startup' | 'resume' | 'clear' | 'compact'; // Per docs
  session_id: string;
}

interface UnmarkedHandoff {
  file: string;
  session_name: string;
  summary: string;
}

interface HandoffSummary {
  filename: string;
  taskNumber: string;
  status: string;
  summary: string;
  isAutoHandoff: boolean;
  branch?: string;
  mtime: Date;
}

/**
 * Prune checkpoint to prevent bloat:
 * 1. Remove all "Session Ended" entries
 * 2. Keep only the last 10 agent reports
 */
function pruneCheckpoint(checkpointPath: string): void {
  let content = fs.readFileSync(checkpointPath, 'utf-8');
  const originalLength = content.length;

  // 1. Remove all "Session Ended" entries
  content = content.replace(/\n### Session Ended \([^)]+\)\n- Reason: \w+\n/g, '');

  // 2. Keep only the last 10 agent reports
  const agentReportsMatch = content.match(/## Agent Reports\n([\s\S]*?)(?=\n## |$)/);
  if (agentReportsMatch) {
    const agentReportsSection = agentReportsMatch[0];
    const reports = agentReportsSection.match(/### [^\n]+ \(\d{4}-\d{2}-\d{2}[^)]*\)[\s\S]*?(?=\n### |\n## |$)/g);

    if (reports && reports.length > 10) {
      // Keep only the last 10 reports
      const keptReports = reports.slice(-10);
      const newAgentReportsSection = '## Agent Reports\n' + keptReports.join('');
      content = content.replace(agentReportsSection, newAgentReportsSection);
    }
  }

  // Only write if content changed
  if (content.length !== originalLength) {
    fs.writeFileSync(checkpointPath, content);
    console.error(`Pruned checkpoint: ${originalLength} -> ${content.length} bytes`);
  }
}

/**
 * Scan handoff directories for files with outcome: UNKNOWN in YAML frontmatter.
 */
function getUnmarkedHandoffs(projectDir: string): UnmarkedHandoff[] {
  const handoffsBase = path.join(projectDir, 'thoughts', 'shared', 'handoffs');
  if (!fs.existsSync(handoffsBase)) return [];

  const results: UnmarkedHandoff[] = [];
  // Walk all handoff directories
  const dirs = fs.readdirSync(handoffsBase, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const dir of dirs) {
    const dirPath = path.join(handoffsBase, dir.name);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      // Check for outcome: UNKNOWN in YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const fm = frontmatterMatch[1];
        if (fm.includes('outcome: UNKNOWN')) {
          // Extract session name and summary
          const topicMatch = fm.match(/topic:\s*"?([^"\n]+)"?/);
          results.push({
            file: filePath.replace(projectDir + '/', ''),
            session_name: dir.name,
            summary: topicMatch?.[1]?.substring(0, 60) || file
          });
        }
      }
    }
  }

  return results.slice(0, 5); // Max 5
}

/**
 * Get the current git branch name.
 */
function getCurrentBranch(projectDir: string): string | null {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch {
    return null;
  }
}

function getLatestHandoff(handoffDir: string, currentBranch: string | null): HandoffSummary | null {
  if (!fs.existsSync(handoffDir)) return null;

  // Match both task-*.md and auto-handoff-*.md files
  const handoffFiles = fs.readdirSync(handoffDir)
    .filter(f => f.endsWith('.md'))
    .sort((a, b) => {
      // Sort by modification time (most recent first)
      const statA = fs.statSync(path.join(handoffDir, a));
      const statB = fs.statSync(path.join(handoffDir, b));
      return statB.mtime.getTime() - statA.mtime.getTime();
    });

  if (handoffFiles.length === 0) return null;

  // Parse all handoffs to find branch matches
  const parsed: HandoffSummary[] = handoffFiles.map(file => {
    const filePath = path.join(handoffDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const stat = fs.statSync(filePath);
    const isAutoHandoff = file.startsWith('auto-handoff-');

    // Extract branch from frontmatter
    let branch: string | undefined;
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const branchMatch = frontmatterMatch[1].match(/branch:\s*"?([^"\n]+)"?/);
      if (branchMatch) branch = branchMatch[1].trim();
    }

    let taskNumber: string;
    let status: string;
    let summary: string;

    if (isAutoHandoff) {
      const typeMatch = content.match(/type:\s*auto-handoff/i);
      status = typeMatch ? 'auto-handoff' : 'unknown';

      const timestampMatch = file.match(/auto-handoff-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
      taskNumber = timestampMatch ? timestampMatch[1] : 'auto';

      const inProgressMatch = content.match(/## In Progress\n([\s\S]*?)(?=\n## |$)/);
      summary = inProgressMatch
        ? inProgressMatch[1].trim().split('\n').slice(0, 3).join('; ').substring(0, 150)
        : 'Auto-handoff from pre-compact';
    } else {
      const taskMatch = file.match(/task-(\d+)/);
      taskNumber = taskMatch ? taskMatch[1] : '??';

      const statusMatch = content.match(/status:\s*(success|partial|blocked)/i);
      status = statusMatch ? statusMatch[1] : 'unknown';

      const summaryMatch = content.match(/## What Was Done\n([\s\S]*?)(?=\n## |$)/);
      summary = summaryMatch
        ? summaryMatch[1].trim().split('\n').slice(0, 2).join('; ').substring(0, 150)
        : 'No summary available';
    }

    return { filename: file, taskNumber, status, summary, isAutoHandoff, branch, mtime: stat.mtime };
  });

  // If we have a current branch, prefer handoffs from the same branch
  if (currentBranch) {
    const branchMatch = parsed.find(h => h.branch === currentBranch);
    if (branchMatch) return branchMatch;
  }

  // Fall back to most recent by mtime (already sorted)
  return parsed[0];
}

async function main() {
  const input: SessionStartInput = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Support both 'source' (per docs) and 'type' (legacy) fields
  const sessionType = input.source || input.type;

  // Get current git branch for handoff matching
  const currentBranch = getCurrentBranch(projectDir);

  // Find existing checkpoints, sorted by modification time
  const checkpointDir = path.join(projectDir, 'thoughts', 'checkpoints');
  if (!fs.existsSync(checkpointDir)) {
    // No thoughts/checkpoints directory - exit silently (normal for new projects)
    console.log(JSON.stringify({ result: 'continue' }));
    return;
  }
  const checkpointFiles = fs.readdirSync(checkpointDir)
    .filter(f => f.startsWith('CHECKPOINT-') && f.endsWith('.md'))
    .sort((a, b) => {
      const statA = fs.statSync(path.join(checkpointDir, a));
      const statB = fs.statSync(path.join(checkpointDir, b));
      return statB.mtime.getTime() - statA.mtime.getTime();
    });

  let message = '';
  let additionalContext = '';

  if (checkpointFiles.length > 0) {
    const mostRecent = checkpointFiles[0];
    const checkpointPath = path.join(checkpointDir, mostRecent);

    // Prune checkpoint before reading to prevent bloat
    pruneCheckpoint(checkpointPath);

    const checkpointContent = fs.readFileSync(checkpointPath, 'utf-8');

    // Extract key sections for summary
    const goalMatch = checkpointContent.match(/## Goal\n([\s\S]*?)(?=\n## |$)/);
    const nowMatch = checkpointContent.match(/- Now: ([^\n]+)/);

    const goalSummary = goalMatch
      ? goalMatch[1].trim().split('\n')[0].substring(0, 100)
      : 'No goal found';

    const currentFocus = nowMatch
      ? nowMatch[1].trim()
      : 'Unknown';

    const sessionName = mostRecent.replace('CHECKPOINT-', '').replace('.md', '');

    // Check for handoff directory
    const handoffDir = path.join(projectDir, 'thoughts', 'shared', 'handoffs', sessionName);
    const latestHandoff = getLatestHandoff(handoffDir, currentBranch);

    if (sessionType === 'startup') {
      // Fresh startup: just notify checkpoint exists, don't load full context
      let startupMsg = `Checkpoint available: ${sessionName} -> ${currentFocus}`;
      if (latestHandoff) {
        if (latestHandoff.isAutoHandoff) {
          startupMsg += ` | Last handoff: auto (${latestHandoff.status})`;
        } else {
          startupMsg += ` | Last handoff: task-${latestHandoff.taskNumber} (${latestHandoff.status})`;
        }

        // Branch mismatch note
        if (currentBranch && latestHandoff.branch && latestHandoff.branch !== currentBranch) {
          startupMsg += ` | NOTE: Latest handoff is from branch ${latestHandoff.branch}, you're on ${currentBranch}`;
        }

        // Stale handoff detection
        const daysSinceHandoff = Math.floor((Date.now() - latestHandoff.mtime.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceHandoff > 7) {
          startupMsg += ` | NOTE: Latest handoff is ${daysSinceHandoff} days old -- may be stale`;
        }
      }
      startupMsg += ' (run /resume-handoff to continue)';
      message = startupMsg;
    } else {
      // resume/clear/compact: load full context
      console.error(`Checkpoint loaded: ${sessionName} -> ${currentFocus}`);
      message = `[${sessionType}] Loaded: ${mostRecent} | Goal: ${goalSummary} | Focus: ${currentFocus}`;

      // For clear/compact, provide full checkpoint content as additional context
      if (sessionType === 'clear' || sessionType === 'compact') {
        additionalContext = `Session checkpoint loaded from ${mostRecent}:\n\n${checkpointContent}`;

        // Check for unmarked handoffs and prompt user to mark outcomes
        const unmarkedHandoffs = getUnmarkedHandoffs(projectDir);
        if (unmarkedHandoffs.length > 0) {
          additionalContext += `\n\n---\n\n## Unmarked Session Outcomes\n\n`;
          additionalContext += `The following handoffs have no outcome marked. Consider marking them to improve future session recommendations:\n\n`;
          for (const h of unmarkedHandoffs) {
            additionalContext += `- **${h.session_name}**: ${h.summary} (\`${h.file}\`)\n`;
          }
          additionalContext += `\nTo mark an outcome, update the \`outcome:\` field in the handoff's YAML frontmatter:\n`;
          additionalContext += `outcome: SUCCEEDED | PARTIAL_PLUS | PARTIAL_MINUS | FAILED\n`;
        }

        // Add handoff context if available
        if (latestHandoff) {
          const handoffPath = path.join(handoffDir, latestHandoff.filename);
          const handoffContent = fs.readFileSync(handoffPath, 'utf-8');

          const handoffLabel = latestHandoff.isAutoHandoff ? 'Latest auto-handoff' : 'Latest task handoff';
          additionalContext += `\n\n---\n\n${handoffLabel} (${latestHandoff.filename}):\n`;
          additionalContext += `Status: ${latestHandoff.status}${latestHandoff.isAutoHandoff ? '' : ` | Task: ${latestHandoff.taskNumber}`}\n`;

          // Branch mismatch note in full context
          if (currentBranch && latestHandoff.branch && latestHandoff.branch !== currentBranch) {
            additionalContext += `NOTE: Latest handoff is from branch ${latestHandoff.branch}, you're on ${currentBranch}\n`;
          }

          // Stale handoff detection in full context
          const daysSinceHandoff = Math.floor((Date.now() - latestHandoff.mtime.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceHandoff > 7) {
            additionalContext += `NOTE: Latest handoff is ${daysSinceHandoff} days old -- may be stale\n`;
          }

          additionalContext += '\n';

          // Include truncated handoff content (first 2000 chars)
          const truncatedHandoff = handoffContent.length > 2000
            ? handoffContent.substring(0, 2000) + '\n\n[... truncated, read full file if needed]'
            : handoffContent;
          additionalContext += truncatedHandoff;

          // List other handoffs in directory
          const allHandoffs = fs.readdirSync(handoffDir)
            .filter(f => f.endsWith('.md'))
            .sort((a, b) => {
              const statA = fs.statSync(path.join(handoffDir, a));
              const statB = fs.statSync(path.join(handoffDir, b));
              return statB.mtime.getTime() - statA.mtime.getTime();
            });
          if (allHandoffs.length > 1) {
            additionalContext += `\n\n---\n\nAll handoffs in ${handoffDir}:\n`;
            allHandoffs.forEach(f => {
              additionalContext += `- ${f}\n`;
            });
          }
        }
      }
    }
  } else {
    // No checkpoint found
    if (sessionType !== 'startup') {
      console.error(`No checkpoint found. Run /checkpoint to track session state.`);
      message = `[${sessionType}] No checkpoint found. Consider running /checkpoint to track session state.`;
    }
    // For startup without checkpoint, stay silent (normal case)
  }

  // Output with proper format per Claude Code docs
  const output: Record<string, unknown> = { result: 'continue' };

  if (message) {
    output.message = message;
  }

  if (additionalContext) {
    output.hookSpecificOutput = {
      hookEventName: 'SessionStart',
      additionalContext: additionalContext
    };
  }

  console.log(JSON.stringify(output));
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

main().catch(console.error);
