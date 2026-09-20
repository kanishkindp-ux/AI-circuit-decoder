import { useState, useRef, useCallback } from 'react';
import { Cpu, X, Check, Pencil } from 'lucide-react';

/**
 * Horizontal banner of editable AI-detected components.
 *
 * Each chip is a text input. On Enter/blur with an edited value,
 * it calls onComponentsChange with the updated array.
 *
 * @param {Object} props
 * @param {string[]} props.components — array of component names
 * @param {(updated: string[]) => void} props.onComponentsChange — callback
 * @param {boolean} props.loading — show skeleton state
 */
export default function ComponentBanner({ components, onComponentsChange, loading }) {
  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-300 tracking-wide uppercase">
            Detected Components
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-9 rounded-full" style={{ width: `${80 + i * 20}px` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!components || components.length === 0) {
    return null;
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-3">
        <Cpu className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-slate-300 tracking-wide uppercase">
          Detected Components
        </span>
        <span className="text-xs text-slate-500 font-normal normal-case ml-1">
          Click to edit, press Enter to re-evaluate
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {components.map((comp, idx) => (
          <EditableChip
            key={idx}
            value={comp}
            onSave={(newVal) => {
              const updated = [...components];
              updated[idx] = newVal;
              onComponentsChange(updated);
            }}
            onRemove={() => {
              const updated = components.filter((_, i) => i !== idx);
              onComponentsChange(updated);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A single editable chip with inline text input.
 */
function EditableChip({ value, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  }, [draft, value, onSave]);

  const startEditing = useCallback(() => {
    setDraft(value);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [value]);

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full px-3 py-1.5 shadow-sm">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(value);
              setEditing(false);
            }
          }}
          onBlur={commit}
          className="bg-transparent text-sm font-medium text-indigo-200 outline-none w-auto min-w-[60px]"
          style={{ width: `${Math.max(draft.length, 6)}ch` }}
          autoFocus
        />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
          className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors"
          aria-label="Confirm edit"
        >
          <Check className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 shadow-sm hover:border-indigo-400/50 hover:bg-white/10 transition-all cursor-pointer">
      <span
        onClick={startEditing}
        className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors"
      >
        {value}
      </span>
      <Pencil
        onClick={startEditing}
        className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors"
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="w-4 h-4 rounded-full flex items-center justify-center text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-all"
        aria-label={`Remove ${value}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
