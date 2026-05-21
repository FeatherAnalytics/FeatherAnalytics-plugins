import * as fs from 'fs';
import * as path from 'path';

interface SubagentStopInput {
  session_id: string;
  transcript_path: string;
  permission_mode: string;
  hook_event_name: string;
  stop_hook_active: boolean;
}

interface TranscriptEntry {
  type: string;
  message?: {
    role: string;
    content: string | Array<{ type: string; text?: string; name?: string }>;
  };
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

interface AgentInfo {
  agentName: string | null;
  task: string;
  outputSummary: string;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk: Buffer) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

function extractText(content: string | Array<{ type: string; text?: string }>): string {
  return typeof content === 'string'
    ? content
    : content.map((c) => c.text || '').join(' ');
}

function parseTranscript(transcriptPath: string): AgentInfo {
  let agentName: string | null = null;
  let task = '';
  let outputSummary = '';

  try {
    if (!fs.existsSync(transcriptPath)) return { agentName: null, task: '', outputSummary: '' };

    const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter((l) => l.trim());
    let lastAssistantText = '';

    for (const line of lines) {
      try {
        const entry: TranscriptEntry = JSON.parse(line);

        // Look for the Task tool call that spawned this agent
        if (entry.tool_name === 'Task' && entry.tool_input) {
          const subagentType = entry.tool_input.subagent_type as string;
          if (subagentType) {
            agentName = subagentType;
            task = (entry.tool_input.prompt as string)?.slice(0, 200) || '';
          }
        }

        // Check for agent file references in messages
        if (!agentName && entry.message?.content) {
          const match = extractText(entry.message.content).match(/\.claude\/agents\/([\w-]+)\.md/);
          if (match) agentName = match[1];
        }

        // Track the last assistant message for output summary
        if (entry.message?.role === 'assistant' && entry.message.content) {
          const text = extractText(entry.message.content).trim();
          if (text) lastAssistantText = text;
        }
      } catch {
        // Skip malformed lines
      }
    }
    outputSummary = lastAssistantText.slice(0, 300);
  } catch {
    // Ignore transcript parsing errors
  }
  return { agentName, task, outputSummary };
}

function appendToCheckpoint(projectDir: string, agentInfo: AgentInfo): void {
  if (!agentInfo.agentName) return;

  const checkpointDir = path.join(projectDir, 'thoughts', 'checkpoints');
  if (!fs.existsSync(checkpointDir)) return;

  const checkpointFiles = fs
    .readdirSync(checkpointDir)
    .filter((f) => f.startsWith('CHECKPOINT-') && f.endsWith('.md'));
  if (checkpointFiles.length === 0) return;

  const mostRecent = checkpointFiles.sort((a, b) => {
    const statA = fs.statSync(path.join(checkpointDir, a));
    const statB = fs.statSync(path.join(checkpointDir, b));
    return statB.mtime.getTime() - statA.mtime.getTime();
  })[0];

  const checkpointPath = path.join(checkpointDir, mostRecent);
  let content = fs.readFileSync(checkpointPath, 'utf-8');

  const timestamp = new Date().toISOString();
  const taskSnippet = agentInfo.task.slice(0, 100);
  const summarySnippet = agentInfo.outputSummary.slice(0, 200);
  const agentReport = `
### ${agentInfo.agentName} (${timestamp})
- Task: ${taskSnippet}${agentInfo.task.length > 100 ? '...' : ''}
- Summary: ${summarySnippet}${agentInfo.outputSummary.length > 200 ? '...' : ''}
`;

  const header = '## Agent Reports\n';
  if (content.includes(header)) {
    const pos = content.indexOf(header) + header.length;
    content = content.slice(0, pos) + agentReport + content.slice(pos);
  } else {
    const archIdx = content.indexOf('## Architecture Summary');
    const hooksIdx = content.indexOf('## Hooks Summary');
    const insertAt = archIdx > 0 ? archIdx : hooksIdx > 0 ? hooksIdx : content.length;
    content = content.slice(0, insertAt) + '\n' + header + agentReport + '\n' + content.slice(insertAt);
  }

  fs.writeFileSync(checkpointPath, content);
}

async function main() {
  const input: SubagentStopInput = JSON.parse(await readStdin());
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Prevent infinite loops
  if (input.stop_hook_active) {
    console.log(JSON.stringify({ result: 'continue' }));
    return;
  }

  try {
    const agentInfo = parseTranscript(input.transcript_path);
    if (!agentInfo.agentName) {
      console.log(JSON.stringify({ result: 'continue' }));
      return;
    }

    appendToCheckpoint(projectDir, agentInfo);
    const message = `[SubagentStop] ${agentInfo.agentName} completed. Report appended to checkpoint.`;
    console.log(JSON.stringify({ result: 'continue', message }));
  } catch {
    console.log(JSON.stringify({ result: 'continue' }));
  }
}

main().catch(console.error);
