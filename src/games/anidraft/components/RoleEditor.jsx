import { useState } from 'react';
import { useConfirm } from '../../../shared/hooks/useConfirm';
import { Badge, Banner, Button, Card, CardRow, GhostButton, Icon, Input } from '../../../shared/ui';
import { MIN_OWN_ROLES } from '../copy';
import { MAX_ROLE_HINT, MAX_ROLE_NAME, normalizeCustomRole } from '../roles';

/**
 * Write your own roles, and see the ones already written on this device.
 *
 * The same shape as AniTag's CategoryEditor, AniWave's SpectrumEditor and
 * AniRank's PromptEditor, and a fourth instance rather than a shared component
 * for their reason: each is a different handful of fields. What they share is
 * the discipline — normalize on the way in, upsert by id, and gate Save on the
 * very function that would refuse the write — and that lives in roles.js.
 *
 * Two fields: the name (what the board, the ballot and the reveal call the
 * role) and an optional line on what it is for, the built-in deck's `hint`.
 *
 * Deleting asks first: a written role is someone's joke, and the ✕ sits a
 * thumb's width from the pencil.
 */
export default function RoleEditor({ roles, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [hint, setHint] = useState('');
  const [editingId, setEditingId] = useState(null);
  const { ask, dialog } = useConfirm();

  const preview = normalizeCustomRole({ id: editingId, name, hint });
  const clear = () => { setName(''); setHint(''); setEditingId(null); };
  const save = () => {
    if (!preview) return;
    onSave(preview);
    clear();
  };
  const onEnter = (e) => { if (e.key === 'Enter') save(); };

  const remove = (role) => ask({
    title: `Delete “${role.name}”?`,
    message: 'It comes out of your deck on this device. A game already dealt keeps it.',
    confirmLabel: 'Delete role',
    cancelLabel: 'Keep',
    onConfirm: () => {
      onDelete(role.id);
      if (editingId === role.id) clear();
    },
  });

  return (
    <Card title="Your own roles" padding="lg" className="mb-6">
      <p className="mb-3 text-sm text-fg-helper">
        A job in the story the table can argue about. Nothing checks who fits it — that’s the vote’s job.
      </p>

      <label htmlFor="anidraft-role-name" className="mb-1 block text-sm font-bold text-fg-body">Role name</label>
      <Input
        id="anidraft-role-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onEnter}
        maxLength={MAX_ROLE_NAME}
        placeholder="e.g. Karaoke Partner"
        autoComplete="off"
        className="mb-3"
      />
      <label htmlFor="anidraft-role-hint" className="mb-1 block text-sm font-bold text-fg-body">
        What it’s for (optional)
      </label>
      <Input
        id="anidraft-role-hint"
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        onKeyDown={onEnter}
        maxLength={MAX_ROLE_HINT}
        placeholder="e.g. Knows every opening by heart"
        autoComplete="off"
        className="mb-3"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="md" disabled={!preview} onClick={save}>
          {editingId ? 'Save changes' : '+ Add role'}
        </Button>
        {editingId && <GhostButton onClick={clear}>Cancel</GhostButton>}
      </div>

      {roles.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="font-display text-xs font-extrabold uppercase tracking-widest text-fg-subtle">
              Written on this device
            </span>
            <Badge tone="neutral">{roles.length}</Badge>
          </div>
          {roles.map((r) => (
            <CardRow key={r.id}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base text-fg-strong">{r.name}</span>
                {r.hint && <span className="block truncate text-sm text-fg-helper">{r.hint}</span>}
              </span>
              <button
                type="button"
                onClick={() => { setEditingId(r.id); setName(r.name); setHint(r.hint ?? ''); }}
                aria-label={`Edit “${r.name}”`}
                className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                  text-base hover:text-fg-strong"
              >
                <Icon name="pencil" />
              </button>
              <button
                type="button"
                onClick={() => remove(r)}
                aria-label={`Delete “${r.name}”`}
                className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                  text-lg font-black text-pop-red hover:text-fg-strong"
              >
                ✕
              </button>
            </CardRow>
          ))}
        </div>
      )}
      {dialog}
    </Card>
  );
}

// Beside the editor that fixes it, never inside a fold (settings-cards.md).
export function OwnRolesBanner({ count }) {
  return (
    <Banner tone="warning" className="mb-6">
      “Only mine” needs at least {MIN_OWN_ROLES} roles — you have {count}. Write {MIN_OWN_ROLES - count} more below, or
      pick another deck.
    </Banner>
  );
}
