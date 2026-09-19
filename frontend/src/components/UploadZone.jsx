import { useState, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, X, BookOpen } from 'lucide-react';

/**
 * Reusable image dropzone with drag-and-drop, click-to-browse,
 * and thumbnail preview.
 *
 * @param {Object} props
 * @param {'circuit' | 'manual'} props.variant — controls icon/label
 * @param {File[]} props.files — controlled file list
 * @param {(files: File[]) => void} props.onFilesChange — callback
 * @param {boolean} [props.multiple=false] — allow multiple files
 */
export default function UploadZone({ variant = 'circuit', files, onFilesChange, multiple = false }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef(null);

  const isCircuit = variant === 'circuit';
  const label = isCircuit ? 'Breadboard Photo' : 'Lab Manual / Reference';
  const sublabel = isCircuit
    ? 'Drop your circuit photo here, or click to browse'
    : 'Drop reference images here (aim, theory, procedure)';
  const Icon = isCircuit ? Upload : BookOpen;
  const accept = 'image/jpeg,image/png,image/webp';

  const handleFiles = useCallback(
    (incoming) => {
      const imageFiles = Array.from(incoming).filter((f) =>
        f.type.startsWith('image/')
      );
      if (imageFiles.length === 0) return;

      if (multiple) {
        onFilesChange([...files, ...imageFiles]);
      } else {
        onFilesChange([imageFiles[0]]);
      }
    },
    [files, multiple, onFilesChange]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragOver(false), []);

  const removeFile = useCallback(
    (index) => {
      const next = files.filter((_, i) => i !== index);
      onFilesChange(next);
    },
    [files, onFilesChange]
  );

  return (
    <div className="space-y-3">
      {/* Label */}
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-semibold text-slate-700 tracking-wide uppercase">
          {label}
        </span>
        {multiple && (
          <span className="text-xs text-slate-400 font-normal normal-case">
            (multiple allowed)
          </span>
        )}
      </div>

      {/* Drop area */}
      <div
        role="button"
        tabIndex={0}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        className={`
          relative flex flex-col items-center justify-center gap-3
          rounded-xl border-2 border-dashed cursor-pointer
          transition-all duration-300 ease-out
          min-h-[180px] px-6 py-8
          ${
            isDragOver
              ? 'dropzone-active border-indigo-500 bg-indigo-50/60'
              : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/80'
          }
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
        `}
      >
        <div
          className={`
            w-12 h-12 rounded-full flex items-center justify-center
            transition-colors duration-300
            ${isDragOver ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}
          `}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-600">
            {sublabel}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            JPG, PNG, or WebP · Max 10 MB
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Thumbnails */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="group relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm"
            >
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(idx);
                }}
                className="
                  absolute top-0.5 right-0.5 w-5 h-5 rounded-full
                  bg-black/60 text-white flex items-center justify-center
                  opacity-0 group-hover:opacity-100 transition-opacity
                  hover:bg-rose-500
                "
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] truncate px-1 py-0.5">
                {file.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
