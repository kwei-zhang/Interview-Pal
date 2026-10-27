import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Database } from '../src/lib/server/database';
import { loadWorkspace } from '../src/lib/server/workspace';

test('Cloud history loads all paginated transcripts and strips internal execution cases', async () => {
  const user = '11111111-1111-4111-8111-111111111111';
  const sessions = ['session-a', 'session-b', 'session-c'];
  const events = sessions.flatMap(session_id => Array.from({length: 400}, (_, position) => ({session_id, data: {id: `${session_id}-${position}`, role: 'candidate', text: `response ${position}`, timestamp: '2026-10-10T12:00:00Z'}})));
  const tables: Record<string, unknown[]> = {
    profiles: [], progress: [], drafts: [], stories: [], links: [],
    sessions: sessions.map(id => ({id, data: {id, status: 'completed'}})),
    events, feedback: [],
    attempts: [{data: {id: 'attempt', code: 'saved code', testCases: [{expected: 'internal'}], sessionId: 'deleted-session'}, session_id: null}],
  };
  const db: Database = {query: async <T>(sql: string, params?: unknown[]) => {
    assert.deepEqual(params, [user]);
    assert.match(sql, /order by session_id,position/);
    return {rows: [tables] as T[]};
  }};
  const workspace = await loadWorkspace(db, user);
  for (const session of workspace.sessions) {
    assert.equal(session.transcript.length, 400);
    assert.equal(session.transcript[399].text, 'response 399');
  }
  assert.equal(workspace.attempts[0].sessionId, undefined);
  assert.equal('testCases' in workspace.attempts[0], false);
  assert.equal(workspace.attempts[0].code, 'saved code');
});
