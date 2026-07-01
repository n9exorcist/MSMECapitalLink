'use client';
// app/console/BriefingComposer.tsx
// Daily Briefing Composer (CFO §9.4). Draft 3 actions with AI (grounded in the client's
// read-model), edit them, then publish → they appear as "Today's 3 Actions" in the owner
// app (§5.2). Publishing replaces the client's action set. Rendered inside <Client360>, so
// it inherits the console's CSS custom properties (--surface, --line, --teal, …).

import { useState } from 'react';
import { draftBriefing, publishBriefing, type BriefAction } from '../lib/api';

const URGENCIES: BriefAction['urgency'][] = ['high', 'medium', 'low'];
const URG_COLOR: Record<string, string> = { high: '#C0392B', medium: '#B45309', low: '#0F766E' };
const EMPTY: BriefAction = { icon: '📌', text: '', detail: '', urgency: 'medium' };

export default function BriefingComposer({ msmeId }: { msmeId?: string }) {
  const [actions, setActions] = useState<BriefAction[]>([]);
  const [source, setSource] = useState<'ai' | 'rules' | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const disabled = !msmeId;

  async function onDraft() {
    if (!msmeId) return;
    setDrafting(true);
    setErr(null);
    setPublished(false);
    try {
      const d = await draftBriefing(msmeId);
      setActions(d.actions.length ? d.actions : [{ ...EMPTY }]);
      setSource(d.source);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  async function onPublish() {
    if (!msmeId) return;
    const clean = actions.filter((a) => a.text.trim());
    if (!clean.length) {
      setErr('Add at least one action before publishing.');
      return;
    }
    setPublishing(true);
    setErr(null);
    try {
      const res = await publishBriefing(msmeId, clean);
      setPublished(true);
      setActions(res.actions);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  function update(i: number, patch: Partial<BriefAction>) {
    setActions((prev) => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
    setPublished(false);
  }
  function remove(i: number) {
    setActions((prev) => prev.filter((_, j) => j !== i));
    setPublished(false);
  }
  function add() {
    setActions((prev) => (prev.length >= 3 ? prev : [...prev, { ...EMPTY }]));
    setPublished(false);
  }

  return (
    <div className="briefwall">
      <div className="sec-h">
        <h3>Daily Briefing Composer</h3>
        <span className="hint">AI-drafted · publishes to the owner app · §9.4</span>
      </div>

      <div className="brief-body">
        <div className="brief-top">
          <button className="btn ai" onClick={onDraft} disabled={disabled || drafting}>
            {drafting ? 'Drafting…' : '✨ Draft with AI'}
          </button>
          {source && (
            <span className="src" style={{ color: source === 'ai' ? '#0F766E' : '#B45309' }}>
              {source === 'ai' ? 'AI-drafted' : 'Rules baseline (add a valid API key for AI polish)'}
            </span>
          )}
          {actions.length > 0 && actions.length < 3 && (
            <button className="btn ghost" onClick={add}>+ Add action</button>
          )}
        </div>

        {actions.length === 0 && !drafting && (
          <div className="brief-empty">
            No briefing yet. Click <b>Draft with AI</b> to suggest 3 actions from this client&apos;s
            data, edit them, then publish to the owner&apos;s home screen.
          </div>
        )}

        {actions.map((a, i) => (
          <div className="brief-row" key={i}>
            <input
              className="emoji"
              value={a.icon ?? ''}
              maxLength={4}
              onChange={(e) => update(i, { icon: e.target.value })}
              aria-label="icon"
            />
            <div className="fields">
              <input
                className="text"
                placeholder="Short action title (jargon-free)"
                value={a.text}
                onChange={(e) => update(i, { text: e.target.value })}
              />
              <input
                className="detail"
                placeholder="One specific sentence — amount, who, by when"
                value={a.detail}
                onChange={(e) => update(i, { detail: e.target.value })}
              />
            </div>
            <select
              className="urg"
              value={a.urgency ?? 'medium'}
              onChange={(e) => update(i, { urgency: e.target.value as BriefAction['urgency'] })}
              style={{ color: URG_COLOR[a.urgency ?? 'medium'] }}
            >
              {URGENCIES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <button className="x" onClick={() => remove(i)} aria-label="remove">×</button>
          </div>
        ))}

        {(err || published) && (
          <div className="brief-msg" style={{ color: err ? 'var(--red)' : '#0F766E' }}>
            {err ? err : `✓ Published — now live in the owner's "Today's 3 Actions".`}
          </div>
        )}

        {actions.length > 0 && (
          <div className="brief-actions">
            <button className="btn pub" onClick={onPublish} disabled={disabled || publishing}>
              {publishing ? 'Publishing…' : 'Publish to owner app'}
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .briefwall{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-top:12px}
        .sec-h{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#FAFCFF,#F4F8FD)}
        .sec-h h3{margin:0;font-size:13px;font-weight:800;color:var(--text)}
        .sec-h .hint{font-size:10.5px;color:var(--muted);font-weight:600}
        .brief-body{padding:12px 14px}
        .brief-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
        .src{font-size:10.5px;font-weight:700}
        .btn{border:0;border-radius:9px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer}
        .btn:disabled{opacity:.5;cursor:default}
        .btn.ai{background:linear-gradient(180deg,var(--teal2),var(--teal));color:#062a26}
        .btn.pub{background:linear-gradient(135deg,#0a2b49,var(--navy2));color:#fff}
        .btn.ghost{background:transparent;border:1px solid var(--border);color:var(--sub)}
        .brief-empty{font-size:11.5px;color:var(--muted);line-height:1.55;padding:6px 2px}
        .brief-row{display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)}
        .emoji{width:40px;text-align:center;font-size:16px;padding:8px 4px;border:1px solid var(--border);border-radius:8px;background:#fff}
        .fields{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0}
        .text,.detail{width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--text);background:#fff}
        .text{font-weight:700}
        .detail{color:var(--sub)}
        .urg{padding:8px 6px;border:1px solid var(--border);border-radius:8px;font-size:11px;font-weight:800;text-transform:capitalize;background:#fff}
        .x{width:26px;height:26px;border-radius:7px;border:1px solid var(--border);background:#fff;color:var(--muted);font-size:16px;font-weight:800;cursor:pointer;flex-shrink:0}
        .brief-msg{font-size:11.5px;font-weight:700;margin-top:10px}
        .brief-actions{display:flex;justify-content:flex-end;margin-top:12px}
      `}</style>
    </div>
  );
}
