// Shapes accepted by POST /api/channel-tools/time-slots and /random-slots
// (see src/services/time-slots-service.js and random-slots-service.js).
import type { Program } from './program'

export interface TimeSlot {
  time: number // ms since the start of the period, integer, 0 <= time < period
  showId: string // a ShowData.showId (e.g. "tv.Some Show"), "flex.", or "redirect.<channel>"
  order?: 'shuffle' | 'next'
}

export interface TimeSlotSchedule {
  timeZoneOffset: number // minutes, from Date.getTimezoneOffset()
  period: number // ms; DAY or WEEK
  slots: TimeSlot[]
  pad: number // ms; round each item's end time up to a multiple of this
  lateness: number // ms; how late a slot may start before falling back to flex
  maxDays: number
  flexPreference: 'distribute' | 'end'
}

export interface RandomSlot {
  duration: number // ms
  showId: string
  order?: 'shuffle' | 'next'
  cooldown?: number // ms
  weight?: number
}

export interface RandomSlotSchedule {
  slots: RandomSlot[]
  pad: number
  maxDays: number
  period: number
  flexPreference: 'distribute' | 'end'
  padStyle: 'slot' | 'episode'
}

export interface ScheduleResult {
  programs: Program[]
  startTime: string
}

export interface ScheduleError {
  userError: string
}

export const DAY_MS = 24 * 60 * 60 * 1000
export const WEEK_MS = 7 * DAY_MS
