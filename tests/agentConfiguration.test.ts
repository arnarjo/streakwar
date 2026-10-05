import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readConfig = (path: string) =>
  JSON.parse(readFileSync(resolve(__dirname, '..', path), 'utf8'));

describe('single-agent repository defaults', () => {
  const settings = readConfig('.claude/settings.json');

  it('disables hooks and teams without executing legacy helpers', () => {
    expect(settings.disableAllHooks).toBe(true);
    expect(settings.env).toEqual({
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '0',
    });
    expect(Object.keys(settings).sort()).toEqual([
      'disableAllHooks', 'env', 'permissions',
    ]);
  });

  it('preserves env protection and denies delegation without broad tool grants', () => {
    expect(settings.permissions).toEqual({
      deny: ['Agent', 'Task', 'mcp__*', 'Read(./.env)', 'Read(./.env.*)'],
    });
  });

  it('does not register or bootstrap any project MCP server', () => {
    expect(readConfig('.mcp.json')).toEqual({ mcpServers: {} });
  });
});
