/* global __dirname: readonly */
// Offline comparison only. Never connects to a DB, executes SQL or repairs history.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function sqlTokens(sql) {
  const tokens = [];
  for (let i = 0; i < sql.length;) {
    if (/\s/.test(sql[i])) { i++; continue; }
    if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i); i = end < 0 ? sql.length : end + 1; continue;
    }
    if (sql.startsWith('/*', i)) {
      let depth = 1; i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) { depth++; i += 2; }
        else if (sql.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw new Error('Unterminated SQL comment');
      continue;
    }
    const start = i;
    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i++]; let closed = false;
      while (i < sql.length) {
        if (sql[i++] === quote) {
          if (sql[i] === quote) i++;
          else { closed = true; break; }
        }
      }
      if (!closed) throw new Error('Unterminated SQL quote');
    } else {
      const dollar = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/);
      if (dollar) {
        const end = sql.indexOf(dollar[0], i + dollar[0].length);
        if (end < 0) throw new Error('Unterminated SQL dollar quote');
        i = end + dollar[0].length;
      } else {
        const word = sql.slice(i).match(/^(?:[A-Za-z_][A-Za-z_0-9$]*|[0-9]+(?:\.[0-9]+)?|::|->>|->|>=|<=|<>|!=|\|\||:=)/);
        i += word ? word[0].length : 1;
      }
    }
    const token = sql.slice(start, i);
    if (token !== ';' || tokens.at(-1) !== ';') tokens.push(token);
  }
  while (tokens.at(-1) === ';') tokens.pop();
  return tokens;
}

function compareHistory(snapshot, localFiles) {
  if (!Array.isArray(snapshot.migrations)) throw new Error('Missing migration array');
  const seen = new Set();
  const rows = snapshot.migrations.map(remote => {
    if (!/^\d+$/.test(remote.version) || !/^[a-z0-9_]+$/.test(remote.name)
        || !Array.isArray(remote.statements) || !remote.statements.length
        || remote.statements.some(s => typeof s !== 'string') || seen.has(remote.version)) {
      throw new Error('Invalid or duplicate migration history entry');
    }
    seen.add(remote.version);
    const candidates = localFiles.filter(f => f.name.startsWith(`${remote.version}_`));
    if (candidates.length > 1) throw new Error(`Duplicate local version ${remote.version}`);
    const sql = remote.statements.join(';\n');
    const local = candidates[0];
    return {
      version: remote.version, remote_name: remote.name,
      statement_count: remote.statements.length,
      // Hash the original statement array, not reconstructed or normalized SQL.
      statement_array_sha256: crypto.createHash('sha256').update(JSON.stringify(remote.statements)).digest('hex'),
      local_file: local?.name ?? null,
      status: !local ? 'REMOTE_ONLY'
        : local.name !== `${remote.version}_${remote.name}.sql` ? 'VERSION_NAME_COLLISION'
          : JSON.stringify(sqlTokens(sql)) === JSON.stringify(sqlTokens(local.sql))
            ? 'TOKEN_MATCH' : 'CONTENT_DIFF',
    };
  });
  for (const local of localFiles) {
    const match = /^(\d+)_(.+)\.sql$/.exec(local.name);
    if (!match) throw new Error(`Unexpected migration filename: ${local.name}`);
    if (!seen.has(match[1])) rows.push({ version: match[1], local_file: local.name, status: 'LOCAL_ONLY' });
  }
  return { project_ref: snapshot.project_ref, captured_on: snapshot.captured_on,
    replay_verified: false,
    note: 'TOKEN_MATCH ignores outer comments/whitespace only, preserves quoted bodies. Not schema equivalence or replay proof.',
    rows };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'docs/relaunch/database/live-history-2026-10-01.json'), 'utf8'));
  const directory = path.join(root, 'supabase/migrations');
  const files = fs.readdirSync(directory).filter(n => n.endsWith('.sql')).sort()
    .map(name => ({ name, sql: fs.readFileSync(path.join(directory, name), 'utf8') }));
  const result = compareHistory(snapshot, files);
  console.log(JSON.stringify(result, null, 2));
  if (result.rows.some(r => r.status !== 'TOKEN_MATCH')) process.exitCode = 1;
}
module.exports = { sqlTokens, compareHistory };
