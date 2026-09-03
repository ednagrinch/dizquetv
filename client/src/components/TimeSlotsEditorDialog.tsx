// Ported from web/directives/time-slots-schedule-editor.js. Lets a user
// define a repeating (daily/weekly) time-of-day schedule assigning shows to
// slots, then asks the server to expand it into a concrete program lineup.
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { channelToolsApi } from '../api'
import { ApiError } from '../api/client'
import type { Program } from '../api/program'
import { DAY_MS, WEEK_MS } from '../api/schedule'
import type { TimeSlot, TimeSlotSchedule } from '../api/schedule'
import { getShowOptions, type ShowOption } from '../lib/programTools'
import { Button, Field, Select, TextInput } from './ui'

// Same order as the old directive's WEEK_DAYS: ms-of-week 0 is Thursday
// because that schedule is anchored to the Unix epoch (Jan 1 1970, a Thursday).
const WEEK_DAYS = ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday']

const PERIOD_OPTIONS = [
  { id: DAY_MS, description: 'Daily' },
  { id: WEEK_MS, description: 'Weekly' },
]

const LATENESS_OPTIONS = [
  { id: 0, description: 'Do not allow' },
  { id: 5 * 60 * 1000, description: '5 minutes' },
  { id: 10 * 60 * 1000, description: '10 minutes' },
  { id: 15 * 60 * 1000, description: '15 minutes' },
  { id: 1 * 60 * 60 * 1000, description: '1 hour' },
  { id: 2 * 60 * 60 * 1000, description: '2 hours' },
  { id: 3 * 60 * 60 * 1000, description: '3 hours' },
  { id: 4 * 60 * 60 * 1000, description: '4 hours' },
  { id: 8 * 60 * 60 * 1000, description: '8 hours' },
  { id: 24 * 60 * 60 * 1000, description: "I don't care about lateness" },
]

const FLEX_OPTIONS = [
  { id: 'distribute', description: 'Between videos' },
  { id: 'end', description: 'End of the slot' },
] as const

const PAD_OPTIONS = [
  { id: 1, description: 'Do not pad' },
  { id: 5 * 60 * 1000, description: '0:00, 0:05, 0:10, ..., 0:55' },
  { id: 10 * 60 * 1000, description: '0:00, 0:10, 0:20, ..., 0:50' },
  { id: 15 * 60 * 1000, description: '0:00, 0:15, 0:30, ..., 0:45' },
  { id: 30 * 60 * 1000, description: '0:00, 0:30' },
  { id: 1 * 60 * 60 * 1000, description: '0:00' },
]

const ORDER_OPTIONS = [
  { id: 'next', description: 'Play Next' },
  { id: 'shuffle', description: 'Shuffle' },
] as const

// Local editing representation: a TimeSlot plus a stable synthetic key so
// rows can be identified/deleted/reordered without relying on object
// identity surviving the (re)sorts below. Stripped before submission.
interface UiTimeSlot extends TimeSlot {
  _key: number
}

interface EditableSchedule {
  period: number
  lateness: number
  maxDays: number
  flexPreference: 'distribute' | 'end'
  pad: number
  slots: UiTimeSlot[]
}

let slotKeySeq = 0
function nextSlotKey(): number {
  slotKeySeq += 1
  return slotKeySeq
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// HTML <input type="time"> value ("HH:MM") for a slot's time-of-day.
function timeOfDayToInput(ms: number): string {
  const t = ((ms % DAY_MS) + DAY_MS) % DAY_MS
  const totalMinutes = Math.floor(t / 60000)
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`
}

function inputToTimeOfDay(value: string): number {
  const [h, m] = value.split(':').map((x) => Number(x) || 0)
  return (h * 60 + m) * 60000
}

function dayOfWeek(ms: number): number {
  return Math.floor(ms / DAY_MS)
}

// Picks a default time for a newly-added slot that doesn't collide with an
// existing one when possible (the old UI just proposed 0 and let the user
// change it via a popup editor).
function nextDefaultTime(slots: UiTimeSlot[], period: number): number {
  if (slots.length === 0) return 0
  const maxTime = Math.max(...slots.map((s) => s.time))
  const candidate = maxTime + 60 * 60 * 1000
  return candidate < period ? candidate : candidate % period
}

// Mirrors refreshSlots(): sort slots by time, force "movie." shows to
// shuffle order, and flag any slot whose time collides with a neighbor.
function normalizeSlots(slots: UiTimeSlot[]): { slots: UiTimeSlot[]; badTimes: boolean; badKeys: Set<number> } {
  const sorted = slots
    .map((s) => (s.showId === 'movie.' ? { ...s, order: 'shuffle' as const } : s))
    .sort((a, b) => a.time - b.time)
  const badKeys = new Set<number>()
  for (let i = 0; i < sorted.length; i++) {
    const dupPrev = i > 0 && sorted[i].time === sorted[i - 1].time
    const dupNext = i + 1 < sorted.length && sorted[i].time === sorted[i + 1].time
    if (dupPrev || dupNext) badKeys.add(sorted[i]._key)
  }
  return { slots: sorted, badTimes: badKeys.size > 0, badKeys }
}

// Mirrors periodChanged(): daily -> weekly clones every slot across all 7
// days; weekly -> daily collapses to unique times-of-day (first wins).
function convertSlotsForPeriod(slots: UiTimeSlot[], fromPeriod: number, toPeriod: number): UiTimeSlot[] {
  if (fromPeriod === toPeriod) return slots
  if (toPeriod === WEEK_MS) {
    const result: UiTimeSlot[] = []
    for (const slot of slots) {
      const base: UiTimeSlot = { ...slot, time: slot.time % DAY_MS }
      result.push(base)
      for (let j = 1; j < 7; j++) {
        result.push({ ...slot, time: base.time + j * DAY_MS, _key: nextSlotKey() })
      }
    }
    return result
  }
  const seen = new Set<number>()
  const result: UiTimeSlot[] = []
  for (const slot of slots) {
    const t = slot.time % DAY_MS
    if (!seen.has(t)) {
      seen.add(t)
      result.push(slot)
    }
  }
  return result
}

function buildInitialSchedule(initial: TimeSlotSchedule | undefined, showOptions: ShowOption[]): EditableSchedule {
  if (!initial) {
    return { period: DAY_MS, lateness: 0, maxDays: 365, flexPreference: 'distribute', pad: 1, slots: [] }
  }
  const validIds = new Set(showOptions.map((o) => o.id))
  const slots: UiTimeSlot[] = initial.slots.map((slot) => {
    const valid = validIds.has(slot.showId)
    return {
      ...slot,
      showId: valid ? slot.showId : 'flex.',
      order: valid ? slot.order : 'shuffle',
      _key: nextSlotKey(),
    }
  })
  return {
    period: initial.period ?? DAY_MS,
    lateness: initial.lateness ?? 0,
    maxDays: initial.maxDays ?? 365,
    flexPreference: initial.flexPreference ?? 'distribute',
    pad: initial.pad ?? 1,
    slots,
  }
}

export interface TimeSlotsEditorDialogProps {
  open: boolean
  programs: Program[]
  initialSchedule?: TimeSlotSchedule
  onCancel: () => void
  onDone: (result: { programs: Program[]; schedule: TimeSlotSchedule }) => void
}

export default function TimeSlotsEditorDialog({
  open,
  programs,
  initialSchedule,
  onCancel,
  onDone,
}: TimeSlotsEditorDialogProps) {
  const showOptions = useMemo(() => getShowOptions(programs), [programs])
  const [schedule, setSchedule] = useState<EditableSchedule>(() => buildInitialSchedule(initialSchedule, showOptions))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-seed the form whenever the dialog transitions from closed to open,
  // but don't clobber in-progress edits on unrelated parent re-renders.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      setSchedule(buildInitialSchedule(initialSchedule, showOptions))
      setError(null)
    }
    wasOpen.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isWeekly = schedule.period === WEEK_MS
  const { slots: sortedSlots, badTimes, badKeys } = useMemo(() => normalizeSlots(schedule.slots), [schedule.slots])

  const disableSubmit = loading || badTimes || sortedSlots.length === 0 || !Number.isFinite(schedule.maxDays)

  // Match by the synthetic _key, not object identity: normalizeSlots()
  // returns new object copies for "movie." rows (to force shuffle order
  // without mutating state), so the row objects rendered in sortedSlots are
  // not always reference-equal to what's sitting in schedule.slots.
  function updateSlot(slot: UiTimeSlot, updates: Partial<TimeSlot>) {
    setSchedule((s) => ({
      ...s,
      slots: s.slots.map((x) => (x._key === slot._key ? { ...x, ...updates } : x)),
    }))
  }

  function deleteSlot(slot: UiTimeSlot) {
    setSchedule((s) => ({ ...s, slots: s.slots.filter((x) => x._key !== slot._key) }))
  }

  function addSlot() {
    const time = nextDefaultTime(schedule.slots, schedule.period)
    setSchedule((s) => ({
      ...s,
      slots: [...s.slots, { time, showId: 'flex.', order: 'next', _key: nextSlotKey() }],
    }))
  }

  function changePeriod(newPeriod: number) {
    setSchedule((s) => ({ ...s, period: newPeriod, slots: convertSlotsForPeriod(s.slots, s.period, newPeriod) }))
  }

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    try {
      const payload: TimeSlotSchedule = {
        timeZoneOffset: new Date().getTimezoneOffset(),
        period: schedule.period,
        lateness: schedule.lateness,
        maxDays: schedule.maxDays,
        flexPreference: schedule.flexPreference,
        pad: schedule.pad,
        slots: sortedSlots.map(({ _key, ...rest }) => rest),
      }
      const result = await channelToolsApi.timeSlots(programs, payload)
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
            <DialogPrimitive.Title className="text-lg font-semibold">Time-based schedule</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Period">
                <Select value={schedule.period} onChange={(e) => changePeriod(Number(e.target.value))}>
                  {PERIOD_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.description}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Allow lateness up to" hint="How late a slot may start before falling back to flex.">
                <Select
                  value={schedule.lateness}
                  onChange={(e) => setSchedule((s) => ({ ...s, lateness: Number(e.target.value) }))}
                >
                  {LATENESS_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.description}
                    </option>
                  ))}
                </Select>
              </Field>
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
                <h3 className="text-sm font-semibold">Time slots</h3>
                <Button variant="secondary" type="button" onClick={addSlot}>
                  <Plus className="h-4 w-4" /> Add slot
                </Button>
              </div>

              {sortedSlots.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No time slots yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Time</th>
                        <th className="px-3 py-2 font-medium">Show</th>
                        <th className="px-3 py-2 font-medium">Order</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {sortedSlots.map((slot) => {
                        const isMovie = slot.showId === 'movie.'
                        const bad = badKeys.has(slot._key)
                        return (
                          <tr key={slot._key} className={bad ? 'bg-red-50 dark:bg-red-950/30' : undefined}>
                            <td className="px-3 py-2 align-top">
                              <div className="flex gap-2">
                                {isWeekly && (
                                  <Select
                                    value={dayOfWeek(slot.time)}
                                    onChange={(e) =>
                                      updateSlot(slot, {
                                        time: Number(e.target.value) * DAY_MS + (slot.time % DAY_MS),
                                      })
                                    }
                                  >
                                    {WEEK_DAYS.map((d, i) => (
                                      <option key={d} value={i}>
                                        {d.slice(0, 3)}
                                      </option>
                                    ))}
                                  </Select>
                                )}
                                <TextInput
                                  type="time"
                                  value={timeOfDayToInput(slot.time)}
                                  onChange={(e) =>
                                    updateSlot(slot, {
                                      time:
                                        (isWeekly ? dayOfWeek(slot.time) * DAY_MS : 0) +
                                        inputToTimeOfDay(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              {bad && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Please select a unique time.</p>}
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
