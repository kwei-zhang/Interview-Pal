import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadWorkspace } from '../src/lib/server/workspace';

test('Cloud history loads all paginated transcripts and strips internal execution cases', async () => {
  const user = '11111111-1111-4111-8111-111111111111';
  const sessions = ['session-a', 'session-b', 'session-c'];
  const events = sessions.flatMap(session_id => Array.from({length: 400}, (_, position) => ({session_id, data: {id: `${session_id}-${position}`, role: 'candidate', text: `response ${position}`, timestamp: '2026-10-10T12:00:00Z'}})));
  const tables: Record<string, unknown[]> = {
    profiles: [], problem_progress: [], code_drafts: [], stories: [], story_question_links: [],
    interview_sessions: sessions.map(id => ({id, data: {id, status: 'completed'}})),
    interview_events: events, session_feedback: [],
    attempts: [{data: {id: 'attempt', code: 'saved code', testCases: [{expected: 'internal'}], sessionId: 'deleted-session'}, session_id: null}],
  };
  const pages: number[] = [];
  const db = createClient('https://database.example', 'test-publishable-key', {auth: {persistSession: false}, global: {fetch: async input => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get('user_id'), `eq.${user}`);
    const table = url.pathname.split('/').at(-1)!;
    const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 500);
    if (table === 'interview_events') {pages.push(offset); assert.ok(url.searchParams.get('order')?.includes('position.asc'));}
    return Response.json(tables[table].slice(offset, offset + limit));
  }}});
  const workspace = await loadWorkspace(db, user);
  assert.deepEqual(pages, [0, 500, 1000]);
  for (const session of workspace.sessions) {
    assert.equal(session.transcript.length, 400);
    assert.equal(session.transcript[399].text, 'response 399');
  }
  assert.equal(workspace.attempts[0].sessionId, undefined);
  assert.equal('testCases' in workspace.attempts[0], false);
  assert.equal(workspace.attempts[0].code, 'saved code');
});
