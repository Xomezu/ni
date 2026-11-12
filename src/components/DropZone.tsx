import { useCallback, useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { collectDroppedFiles } from '../chart/loadBundle';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  compact?: boolean;
}

export function DropZone({ onFiles, busy, compact }: DropZoneProps) {
  const [active, setActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = folderRef.current;
    if (!el) return;
    el.setAttribute('webkitdirectory', '');
    el.setAttribute('directory', '');
  });

  const handleFiles = useCallback(
    (list: FileList | File[]) => {
      const files = [...list];
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setActive(false);
    const files = await collectDroppedFiles(e.dataTransfer);
    handleFiles(files);
  };

  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-[var(--paper)] transition hover:bg-[var(--ink-soft)] disabled:opacity-50"
        >
          Open chart
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => folderRef.current?.click()}
          className="rounded-md border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm text-[var(--ink)] transition hover:bg-[var(--paper-2)] disabled:opacity-50"
        >
          Open folder
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".chart,.ogg,.mp3,.opus,.wav,.m4a,.ini,.png,.jpg,.jpeg"
          multiple
          className="hidden"
          onChange={onSelect}
        />
        <input ref={folderRef} type="file" multiple className="hidden" onChange={onSelect} />
      </div>
    );
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setActive(false);
      }}
      onDrop={onDrop}
      className={`relative overflow-hidden rounded-2xl border border-dashed px-6 py-10 text-center transition ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
          : 'border-[var(--line)] bg-[var(--paper-2)]/70'
      }`}
    >
      <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
        Drop a song folder
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
        Bring <code className="text-[var(--ink)]">notes.chart</code> plus audio (
        <code className="text-[var(--ink)]">song.ogg</code> / stems). Optional{' '}
        <code className="text-[var(--ink)]">song.ini</code> and album art welcome.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--paper)] transition hover:bg-[var(--ink-soft)] disabled:opacity-50"
        >
          Choose files
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => folderRef.current?.click()}
          className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--paper)] disabled:opacity-50"
        >
          Choose folder
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".chart,.ogg,.mp3,.opus,.wav,.m4a,.ini,.png,.jpg,.jpeg"
        multiple
        className="hidden"
        onChange={onSelect}
      />
      <input ref={folderRef} type="file" multiple className="hidden" onChange={onSelect} />
    </div>
  );
}
