import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import type { Program } from '../../api/program'
import { formatDuration, getProgramDisplayTitle, programColor } from '../../lib/programTools'

export default function ProgramListItem({
  id,
  program,
  onRemove,
}: {
  id: string
  program: Program
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-0 dark:border-slate-800"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ background: program.isOffline ? undefined : programColor(program) }}
      />
      <span className="flex-1 truncate text-sm">
        {program.isOffline && program.type !== 'redirect'
          ? `Flex (${formatDuration(program.duration)})`
          : program.type === 'redirect'
            ? `Redirect to channel ${program.channel}`
            : getProgramDisplayTitle(program)}
      </span>
      <span className="shrink-0 text-xs text-slate-400">{formatDuration(program.duration)}</span>
      <button
        onClick={onRemove}
        className="shrink-0 text-slate-400 hover:text-red-600"
        title="Remove"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  )
}
