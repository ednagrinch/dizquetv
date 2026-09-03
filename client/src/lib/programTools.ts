// Ported from src/services/get-show-data.js and web/services/common-program-tools.js
// (the same logic exists in both the old server and client — this is the
// client-side copy). Pure functions over Program objects; no I/O.
import type { Program } from '../api/program'

export interface ShowData {
  hasShow: boolean
  showId?: string
  showDisplayName?: string
  order?: number
  shuffleOrder?: number
  channel?: number
}

const movieTitleOrder = new Map<string, number>()
let movieTitleOrderNumber = 0

export function getShowData(program: Program): ShowData {
  if (typeof program.customShowId !== 'undefined') {
    return {
      hasShow: true,
      showId: 'custom.' + program.customShowId,
      showDisplayName: program.customShowName,
      order: program.customOrder,
      shuffleOrder: program.shuffleOrder,
    }
  } else if (program.isOffline && program.type === 'redirect') {
    return {
      hasShow: true,
      showId: 'redirect.' + program.channel,
      order: program.duration,
      showDisplayName: `Redirect to channel ${program.channel}`,
      channel: program.channel,
    }
  } else if (program.isOffline) {
    return { hasShow: false }
  } else if (program.type === 'movie') {
    const key = `${program.serverKey}|${program.key}`
    if (!movieTitleOrder.has(key)) {
      movieTitleOrder.set(key, movieTitleOrderNumber++)
    }
    return {
      hasShow: true,
      showId: 'movie.',
      showDisplayName: 'Movies',
      order: movieTitleOrder.get(key),
      shuffleOrder: program.shuffleOrder,
    }
  } else if (program.type === 'episode' || program.type === 'track') {
    const s = program.season ?? 0
    const e = program.episode ?? 0
    const prefix = program.type === 'track' ? 'audio.' : 'tv.'
    return {
      hasShow: true,
      showId: prefix + program.showTitle,
      showDisplayName: program.showTitle,
      order: s * 1000000 + e,
      shuffleOrder: program.shuffleOrder,
    }
  }
  return { hasShow: false }
}

export function getProgramId(program: Program): string {
  return `${program.serverKey ?? 'unknown'}|${program.key ?? 'unknown'}`
}

export function getProgramDisplayTitle(program: Program): string {
  let s =
    program.type === 'episode'
      ? `${program.showTitle} - S${String(program.season ?? 0).padStart(2, '0')}E${String(
          program.episode ?? 0,
        ).padStart(2, '0')}`
      : (program.title ?? 'Untitled')
  if (typeof program.customShowId !== 'undefined') {
    s = `${program.customShowName} X${String((program.customOrder ?? 0) + 1).padStart(2, '0')} (${s})`
  }
  return s
}

export function sortShows(programs: Program[]): Program[] {
  const shows = new Map<string, Program[]>()
  const movies: Program[] = []
  const order: string[] = []

  for (const p of programs) {
    const data = getShowData(p)
    if (!data.hasShow || data.showId === 'movie.') {
      movies.push(p)
    } else {
      if (!shows.has(data.showId!)) {
        shows.set(data.showId!, [])
        order.push(data.showId!)
      }
      shows.get(data.showId!)!.push(p)
    }
  }

  let result: Program[] = []
  for (const id of order) {
    const group = shows.get(id)!
    group.sort((a, b) => (getShowData(a).order ?? 0) - (getShowData(b).order ?? 0))
    result = result.concat(group)
  }
  movies.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
  return result.concat(movies)
}

export function removeDuplicates(programs: Program[]): Program[] {
  const seen = new Map<string, Program>()
  for (const p of programs) {
    if (p.type === 'redirect') {
      seen.set(`_redirect ${p.channel} _ ${p.duration}`, p)
      continue
    }
    const data = getShowData(p)
    if (data.hasShow) {
      const key = `${data.showId}|${data.order}`
      if (!seen.has(key)) seen.set(key, p)
    }
  }
  return Array.from(seen.values())
}

export function shuffle<T>(array: T[]): T[] {
  const copy = array.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// A stable, deterministic color for a program's list tile — same hashing
// approach as web/services/common-program-tools.js's programSquareStyle,
// simplified to a single background color rather than a full CSS gradient.
export function programColor(program: Program): string {
  if (program.isOffline && program.type !== 'redirect') return '#94a3b8'
  const seedStr =
    program.type === 'redirect'
      ? `redirect-${program.channel}`
      : (program.customShowId ?? program.showTitle ?? program.title ?? 'x')
  let hash = 0
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 55%)`
}

export interface ShowOption {
  id: string
  description: string
}

// Mirrors startDialog() in the old web/directives/time-slots-schedule-editor.js
// and random-slots-schedule-editor.js: the distinct set of "shows" (grouped by
// getShowData().showId) found across a channel's programs, plus a "Flex" entry.
export function getShowOptions(programs: Program[]): ShowOption[] {
  const seen = new Map<string, ShowOption>()
  for (const p of programs) {
    const data = getShowData(p)
    if (data.hasShow && !seen.has(data.showId!)) {
      seen.set(data.showId!, { id: data.showId!, description: data.showDisplayName ?? data.showId! })
    }
  }
  const options = Array.from(seen.values())
  options.push({ id: 'flex.', description: 'Flex' })
  return options
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
