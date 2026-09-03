import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { GripVertical, Loader2, Pencil, Plus, Trash2, Tv, X } from 'lucide-react'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { showsApi } from '../api'
import type { CustomShow, Program } from '../api/program'
import { getProgramDisplayTitle, formatDuration } from '../lib/programTools'
import { Button, Card, Field, PageHeader, TextInput } from '../components/ui'
import { Dialog } from '../components/Dialog'

function SortableShowRow({ program, index, onRemove }: { program: Program; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${index}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 border-b border-slate-200 py-2 last:border-b-0 dark:border-slate-800 ${
        isDragging ? 'bg-slate-50 dark:bg-slate-800' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:hover:text-slate-200"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{getProgramDisplayTitle(program)}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{formatDuration(program.duration)}</p>
      </div>
      <Button variant="ghost" onClick={onRemove} title="Remove from show">
        <X className="h-4 w-4" />
      </Button>
    </li>
  )
}

function CustomShowContentDialog({
  show,
  onClose,
  onSaved,
}: {
  show: CustomShow
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(show.name)
  const [content, setContent] = useState<Program[]>(show.content)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = Number(active.id)
    const newIndex = Number(over.id)
    setContent((items) => arrayMove(items, oldIndex, newIndex))
  }

  function removeAt(index: number) {
    setContent((items) => items.filter((_, i) => i !== index))
  }

  async function save() {
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }
    setSaving(true)
    try {
      await showsApi.update(show.id, { ...show, name: name.trim(), content })
      toast.success(`Custom show "${name.trim()}" saved.`)
      onSaved()
    } catch (e) {
      toast.error(`Failed to save custom show: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <DialogPrimitive.Title className="text-lg font-semibold">Edit custom show</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-4">
            <Field label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Adding programs from your Plex library isn't available in this screen yet.
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                Content ({content.length} {content.length === 1 ? 'item' : 'items'})
              </p>
              {content.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">This custom show is empty.</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={content.map((_, i) => `${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="max-h-96 overflow-y-auto">
                      {content.map((program, index) => (
                        <SortableShowRow
                          key={index}
                          program={program}
                          index={index}
                          onRemove={() => removeAt(index)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={saving} onClick={save}>
                Save changes
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function CreateCustomShowDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }
    setSaving(true)
    try {
      await showsApi.create({ name: name.trim(), content: [] })
      toast.success(`Custom show "${name.trim()}" created.`)
      onCreated()
    } catch (e) {
      toast.error(`Failed to create custom show: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Add custom show">
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={create}>
            Create
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export default function CustomShowsPage() {
  const [shows, setShows] = useState<CustomShow[] | null>(null)
  const [editing, setEditing] = useState<CustomShow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  function refresh() {
    showsApi
      .list()
      .then(setShows)
      .catch((e) => toast.error(`Failed to load custom shows: ${e}`))
  }

  useEffect(refresh, [])

  async function remove(show: CustomShow) {
    if (!confirm(`Delete custom show "${show.name}"?`)) return
    setDeleting(show.id)
    try {
      await showsApi.remove(show.id)
      toast.success(`Deleted "${show.name}".`)
      refresh()
    } catch (e) {
      toast.error(`Failed to delete custom show: ${e}`)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader title="Custom Shows" description="Group programs into your own shows to schedule as a unit." />
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Custom shows</h2>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add custom show
          </Button>
        </div>

        {shows === null ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : shows.length === 0 ? (
          <p className="text-sm text-slate-500">No custom shows yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {shows.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => setEditing(s)}
                >
                  <Tv className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      {s.content.length} {s.content.length === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" onClick={() => setEditing(s)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    loading={deleting === s.id}
                    onClick={() => remove(s)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <CustomShowContentDialog
          show={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}

      {creating && (
        <CreateCustomShowDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}
