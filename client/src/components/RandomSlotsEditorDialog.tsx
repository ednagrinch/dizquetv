// Ported from web/directives/random-slots-schedule-editor.js. Lets a user
// define a pool of randomly-drawn slots (duration + assigned show + optional
// cooldown/weight), then asks the server to expand it into a concrete
// program lineup.
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { channelToolsApi } from '../api'
import { ApiError } from '../api/client'
import type { Program } from '../api/program'
import { DAY_MS } from '../api/schedule'
import type { RandomSlot, RandomSlotSchedule } from '../api/schedule'
import { getShowOptions, type ShowOption } from '../lib/programTools'
import { Button, Field, Select, TextInput } from './ui'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = DAY_MS

const DURATION_OPTIONS = [
  { id: 5 * MINUTE, description: '5 Minutes' },
  { id: 10 * MINUTE, description: '10 Minutes' },
  { id: 15 * MINUTE, description: '15 Minutes' },
  { id: 20 * MINUTE, description: '20 Minutes' },
  { id: 25 * MINUTE, description: '25 Minutes' },
  { id: 30 * MINUTE, description: '30 Minutes' },
  { id: 45 * MINUTE, description: '45 Minutes' },
  { id: 1 * HOUR, description: '1 Hour' },
  { id: 90 * MINUTE, description: '90 Minutes' },
  { id: 100 * MINUTE, description: '100 Minutes' },
  { id: 2 * HOUR, description: '2 Hours' },
  { id: 3 * HOUR, description: '3 Hours' },
  { id: 4 * HOUR, description: '4 Hours' },
  { id: 5 * HOUR, description: '5 Hours' },
  { id: 6 * HOUR, description: '6 Hours' },
  { id: 8 * HOUR, description: '8 Hours' },
  { id: 10 * HOUR, description: '10 Hours' },
  { id: 12 * HOUR, description: '12 Hours' },
  { id: 1 * DAY, description: '1 Day' },
]

const COOLDOWN_OPTIONS = [
  { id: 0, description: 'No cooldown' },
  { id: 1 * MINUTE, description: '1 Minute' },
  { id: 5 * MINUTE, description: '5 Minutes' },
  { id: 10 * MINUTE, description: '10 Minutes' },
  { id: 15 * MINUTE, description: '15 Minutes' },
  { id: 20 * MINUTE, description: '20 Minutes' },
  { id: 25 * MINUTE, description: '25 Minutes' },
  { id: 30 * MINUTE, description: '30 Minutes' },
  { id: 45 * MINUTE, description: '45 Minutes' },
  { id: 1 * HOUR, description: '1 Hour' },
  { id: 90 * MINUTE, description: '90 Minutes' },
  { id: 100 * MINUTE, description: '100 Minutes' },
  { id: 2 * HOUR, description: '2 Hours' },
  { id: 3 * HOUR, description: '3 Hours' },
  { id: 4 * HOUR, description: '4 Hours' },
  { id: 5 * HOUR, description: '5 Hours' },
  { id: 6 * HOUR, description: '6 Hours' },
  { id: 8 * HOUR, description: '8 Hours' },
  { id: 10 * HOUR, description: '10 Hours' },
  { id: 12 * HOUR, description: '12 Hours' },
  { id: 1 * DAY, description: '1 Day' },
  // The original had a copy-paste bug here (id: 1*DAY, silently duplicating
  // "1 Day"). Fixed to 2*DAY so the option actually means what it says.
  { id: 2 * DAY, description: '2 Days' },
  { id: 3 * DAY + 12 * HOUR, description: '3.5 Days' },
  { id: 7 * DAY, description: '1 Week' },
]

const FLEX_OPTIONS = [
  { id: 'distribute', description: 'Between videos' },
  { id: 'end', description: 'End of the slot' },
] as const

const DISTRIBUTION_OPTIONS = [
  { id: 'uniform', description: 'Uniform' },
  { id: 'weighted', description: 'Weighted' },
] as const

const PAD_OPTIONS = [
  { id: 1, description: 'Do not pad' },
  { id: 1 * MINUTE, description: '0:00, 0:01, 0:02, ..., 0:59' },
  { id: 5 * MINUTE, description: '0:00, 0:05, 0:10, ..., 0:55' },
  { id: 10 * MINUTE, description: '0:00, 0:10, 0:20, ..., 0:50' },
  { id: 15 * MINUTE, description: '0:00, 0:15, 0:30, ..., 0:45' },
  { id: 30 * MINUTE, description: '0:00, 0:30' },
  { id: 1 * HOUR, description: '0:00' },
]

const PAD_STYLE_OPTIONS = [
  { id: 'episode', description: 'Pad Episodes' },
  { id: 'slot', description: 'Pad Slots' },
] as const

const ORDER_OPTIONS = [
  { id: 'next', description: 'Play Next' },
  { id: 'shuffle', description: 'Shuffle' },
] as const

type Distribution = 'uniform' | 'weighted'

// Local editing representation: a RandomSlot plus a stable synthetic key so
// rows can be identified/deleted without relying on object identity.
// Stripped before submission.
interface UiRandomSlot extends RandomSlot {
  _key: number
}

interface EditableSchedule {
  maxDays: number
  flexPreference: 'distribute' | 'end'
  padStyle: 'slot' | 'episode'
  pad: number
  slots: UiRandomSlot[]
}

let slotKeySeq = 0
function nextSlotKey(): number {
  slotKeySeq += 1
  return slotKeySeq
}

// randomDistribution isn't part of the server's RandomSlotSchedule shape
// (see api/schedule.ts) — it's purely a local convenience that batch-sets
// every slot's weight, mirroring the old randomDistributionChanged().
function inferDistribution(slots: { weight?: number }[]): Distribution {
  if (slots.length === 0) return 'uniform'
  return slots.every((s) => (s.weight ?? 1) <= 1) ? 'uniform' : 'weighted'
}

// Mirrors refreshSlots(): force "movie." shows to shuffle order and default
// a missing/NaN cooldown to 0. Also computes each slot's share of the total
// weight, for display only.
function normalizeSlots(slots: UiRandomSlot[]): { slots: UiRandomSlot[]; weightPercentages: Map<number, string> } {
  const normalized = slots.map((s) => ({
    ...s,
    order: s.showId === 'movie.' ? ('shuffle' as const) : s.order,
    cooldown: Number.isFinite(s.cooldown) ? s.cooldown : 0,
  }))
  const sum = normalized.reduce((acc, s) => acc + (s.weight ?? 1), 0)
  const weightPercentages = new Map<number, string>()
  for (const s of normalized) {
    weightPercentages.set(s._key, sum > 0 ? `${((100 * (s.weight ?? 1)) / sum).toFixed(2)}%` : '0.00%')
  }
  return { slots: normalized, weightPercentages }
}

function buildInitialSchedule(
  initial: RandomSlotSchedule | undefined,
  showOptions: ShowOption[],
): EditableSchedule {
  if (!initial) {
    return { maxDays: 365, flexPreference: 'distribute', padStyle: 'slot', pad: 1, slots: [] }
  }
  const validIds = new Set(showOptions.map((o) => o.id))
  const slots: UiRandomSlot[] = initial.slots.map((slot) => {
    const valid = validIds.has(slot.showId)
    return {
      ...slot,
      showId: valid ? slot.showId : 'flex.',
      order: valid ? slot.order : 'shuffle',
      cooldown: slot.cooldown ?? 0,
      weight: slot.weight ?? 1,
      _key: nextSlotKey(),
    }
  })
  return {
    maxDays: initial.maxDays ?? 365,
    flexPreference: initial.flexPreference ?? 'distribute',
    padStyle: initial.padStyle ?? 'slot',
    pad: initial.pad ?? 1,
    slots,
  }
}

export interface RandomSlotsEditorDialogProps {
  open: boolean
  programs: Program[]
  initialSchedule?: RandomSlotSchedule
  onCancel: () => void
  onDone: (result: { programs: Program[]; schedule: RandomSlotSchedule }) => void
}

export default function RandomSlotsEditorDialog({
  open,
  programs,
  initialSchedule,
  onCancel,
  onDone,
}: RandomSlotsEditorDialogProps) {
  const showOptions = useMemo(() => getShowOptions(programs), [programs])
  const [schedule, setSchedule] = useState<EditableSchedule>(() => buildInitialSchedule(initialSchedule, showOptions))
  const [distribution, setDistribution] = useState<Distribution>(() => inferDistribution(schedule.slots))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-seed the form whenever the dialog transitions from closed to open,
  // but don't clobber in-progress edits on unrelated parent re-renders.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      const initial = buildInitialSchedule(initialSchedule, showOptions)
      setSchedule(initial)
      setDistribution(inferDistribution(initial.slots))
      setError(null)
    }
    wasOpen.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const { slots: normalizedSlots, weightPercentages } = useMemo(() => normalizeSlots(schedule.slots), [schedule.slots])

  const disableSubmit = loading || normalizedSlots.length === 0 || !Number.isFinite(schedule.maxDays)

  // Match by the synthetic _key, not object identity: normalizeSlots()
  // always returns fresh object copies, so the row objects rendered in
  // normalizedSlots are never reference-equal to what's in schedule.slots.
  function updateSlot(slot: UiRandomSlot, updates: Partial<RandomSlot>) {
    setSchedule((s) => ({
      ...s,
      slots: s.slots.map((x) => (x._key === slot._key ? { ...x, ...updates } : x)),
    }))
  }

  function deleteSlot(slot: UiRandomSlot) {
    setSchedule((s) => ({ ...s, slots: s.slots.filter((x) => x._key !== slot._key) }))
  }

  function addSlot() {
    setSchedule((s) => ({
      ...s,
      slots: [
        ...s.slots,
        {
          duration: 30 * MINUTE,
          showId: 'flex.',
          order: 'next',
          cooldown: 0,
          weight: distribution === 'weighted' ? 300 : 1,
          _key: nextSlotKey(),
        },
      ],
    }))
  }

  function changeDistribution(d: Distribution) {
    setDistribution(d)
    setSchedule((s) => ({ ...s, slots: s.slots.map((slot) => ({ ...slot, weight: d === 'uniform' ? 1 : 300 })) }))
  }

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      const payload: RandomSlotSchedule = {
        // Not exposed in the UI (the old directive never set it either) —
        // the server defaults this to a day when omitted.
        period: DAY_MS,
        pad: schedule.pad,
        maxDays: schedule.maxDays,
        flexPreference: schedule.flexPreference,
        padStyle: schedule.padStyle,
        slots: normalizedSlots.map(({ _key, ...rest }) => rest),
      }
      const result = await channelToolsApi.randomSlots(programs, payload)
      onDone({ programs: result.programs, schedule: payload })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'There was an error processing the schedule.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <DialogPrimitive.Title className="text-lg font-semibold">Random schedule</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Pad times to">
                <Select
                  value={schedule.pad}
                  onChange={(e) => setSchedule((s) => ({ ...s, pad: Number(e.target.value) }))}
                >
                  {PAD_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.description}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Pad style">
                <Select
                  value={schedule.padStyle}
                  onChange={(e) => setSchedule((s) => ({ ...s, padStyle: e.target.value as 'slot' | 'episode' }))}
                >
                  {PAD_STYLE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.description}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Flex placement">
                <Select
                  value={schedule.flexPreference}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, flexPreference: e.target.value as 'distribute' | 'end' }))
                  }
                >
                  {FLEX_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.description}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Weight distribution" hint="Weighted lets each slot's weight control how often it's picked.">
                <Select value={distribution} onChange={(e) => changeDistribution(e.target.value as Distribution)}>
                  {DISTRIBUTION_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.description}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Max days to precalculate">
                <TextInput
                  type="number"
                  min={1}
                  value={Number.isFinite(schedule.maxDays) ? schedule.maxDays : ''}
                  onChange={(e) =>
                    setSchedule((s) => ({ ...s, maxDays: e.target.value === '' ? NaN : Number(e.target.value) }))
                  }
                />
              </Field>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Random slots</h3>
                <Button variant="secondary" type="button" onClick={addSlot}>
                  <Plus className="h-4 w-4" /> Add slot
                </Button>
              </div>

              {normalizedSlots.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No random slots yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Duration</th>
                        <th className="px-3 py-2 font-medium">Show</th>
                        <th className="px-3 py-2 font-medium">Order</th>
                        <th className="px-3 py-2 font-medium">Cooldown</th>
                        {distribution === 'weighted' && <th className="px-3 py-2 font-medium">Weight</th>}
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {normalizedSlots.map((slot) => {
                        const isMovie = slot.showId === 'movie.'
                        return (
                          <tr key={slot._key}>
                            <td className="px-3 py-2 align-top">
                              <Select
                                value={slot.duration}
                                onChange={(e) => updateSlot(slot, { duration: Number(e.target.value) })}
                              >
                                {DURATION_OPTIONS.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.description}
                                  </option>
                                ))}
                              </Select>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <Select
                                value={slot.showId}
                                onChange={(e) =>
                                  updateSlot(slot, {
                                    showId: e.target.value,
                                    order: e.target.value === 'movie.' ? 'shuffle' : slot.order,
                                  })
                                }
                              >
                                {showOptions.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.description}
                                  </option>
                                ))}
                              </Select>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <Select
                                value={isMovie ? 'shuffle' : (slot.order ?? 'next')}
                                disabled={isMovie}
                                onChange={(e) => updateSlot(slot, { order: e.target.value as 'next' | 'shuffle' })}
                              >
                                {ORDER_OPTIONS.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.description}
                                  </option>
                                ))}
                              </Select>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <Select
                                value={slot.cooldown ?? 0}
                                onChange={(e) => updateSlot(slot, { cooldown: Number(e.target.value) })}
                              >
                                {COOLDOWN_OPTIONS.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.description}
                                  </option>
                                ))}
                              </Select>
                            </td>
                            {distribution === 'weighted' && (
                              <td className="px-3 py-2 align-top">
                                <TextInput
                                  type="number"
                                  min={0}
                                  className="w-24"
                                  value={slot.weight ?? 1}
                                  onChange={(e) => updateSlot(slot, { weight: Number(e.target.value) })}
                                />
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {weightPercentages.get(slot._key)}
                                </p>
                              </td>
                            )}
                            <td className="px-3 py-2 align-top">
                              <Button variant="ghost" type="button" onClick={() => deleteSlot(slot)} title="Delete slot">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={disableSubmit} loading={loading}>
                Create lineup
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
