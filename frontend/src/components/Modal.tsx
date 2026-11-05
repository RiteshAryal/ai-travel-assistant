import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

type Props = {
  titleId: string
  title: string
  subtitle: ReactNode
  onClose: () => void
  onKeyDown?: (e: KeyboardEvent) => void
  wide?: boolean
  children: ReactNode
}

export function Modal({ titleId, title, subtitle, onClose, onKeyDown, wide, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // showModal gives focus trap, Esc to close and focus return for free.
  // No close() in cleanup: its async "close" event would call onClose after a StrictMode remount.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby={titleId}
      className={`m-auto max-h-[92vh] overflow-y-auto rounded-xl bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/50 ${
        wide ? 'w-[min(62rem,95vw)]' : 'w-[min(44rem,95vw)]'
      }`}
    >
      <div className="space-y-5 p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-xl leading-none text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
