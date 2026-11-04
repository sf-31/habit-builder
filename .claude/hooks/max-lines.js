#!/usr/bin/env node
// Claude Code hook: keeps every file at or under MAX lines.
//
// PreToolUse (Write/Edit/MultiEdit): works out what the file would look like
// after the change and blocks the change if it would be too long.
// PostToolUse (Bash): shell commands can write files too, so after each one
// scan the repo and report any file that is now too long.
//
// Exit code 2 sends the message on stderr back to Claude.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MAX = 300;
// Generated files nobody edits by hand.
const EXEMPT = [/(^|\/)package-lock\.json$/];

const countLines = (text) => {
  if (!text) return 0;
  const n = text.split('\n').length;
  return text.endsWith('\n') ? n - 1 : n;
};
const isExempt = (file) => EXEMPT.some((re) => re.test(file.split(path.sep).join('/')));
const readOr = (file, fallback) => { try { return fs.readFileSync(file, 'utf8'); } catch { return fallback; } };

function applyEdit(text, { old_string, new_string, replace_all }) {
  if (old_string === '') return new_string; // creating a file
  return replace_all ? text.split(old_string).join(new_string) : text.replace(old_string, () => new_string);
}

function afterChange(tool, input) {
  if (tool === 'Write') return input.content;
  const current = readOr(input.file_path, '');
  if (tool === 'Edit') return applyEdit(current, input);
  if (tool === 'MultiEdit') return (input.edits || []).reduce(applyEdit, current);
  return null;
}

function tooLongInRepo(cwd) {
  let files;
  try {
    files = execSync('git ls-files -z --cached --others --exclude-standard', { cwd, encoding: 'utf8' })
      .split('\0').filter(Boolean);
  } catch { return []; }
  return files
    .filter((f) => !isExempt(f))
    .map((f) => {
      const text = readOr(path.join(cwd, f), null);
      return text == null || text.includes('\0') ? null : { f, n: countLines(text) };
    })
    .filter((r) => r && r.n > MAX);
}

let raw = '';
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  const event = JSON.parse(raw);
  const tool = event.tool_name;
  const input = event.tool_input || {};

  if (tool === 'Bash') {
    const long = tooLongInRepo(event.cwd || process.cwd());
    if (!long.length) process.exit(0);
    const list = long.map(({ f, n }) => `  ${f}: ${n} lines`).join('\n');
    process.stderr.write(`These files are over the ${MAX}-line limit:\n${list}\nSplit them into smaller files.\n`);
    process.exit(2);
  }

  const file = input.file_path;
  if (!file || isExempt(file)) process.exit(0);
  const text = afterChange(tool, input);
  if (text == null) process.exit(0);
  const n = countLines(text);
  if (n <= MAX) process.exit(0);
  process.stderr.write(
    `Blocked: ${path.basename(file)} would be ${n} lines; the limit is ${MAX}. ` +
    'Split it into smaller files (by screen, feature or concern) instead.\n'
  );
  process.exit(2);
});
