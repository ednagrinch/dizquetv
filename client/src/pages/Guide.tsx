import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2, Play, Settings2 } from 'lucide-react'
import { channelsApi, guideApi, type ChannelLineup, type GuideEntry } from '../api'
import { Button, Select } from '../components/ui'

const HOUR_MS = 60 * 60 * 1000

function roundDownToHour(d: Date) {
  const t = new Date(d)
  t.setMinutes(0, 0, 0)
  return t
}

export default function GuidePage() {
  const [windowStart, setWindowStart] = useState(() => roundDownToHour(new Date()))
  const [hoursVisible, setHoursVisible] = useState(4)
  const [lineups, setLineups] = useState<Record<number, ChannelLineup | null> | null>(null)
  const [selected, setSelected] = useState<{ channel: number; entry: GuideEntry } | null>(null)
  const [now, setNow] = useState(() => new Date())

  const windowEnd = useMemo(
    () => new Date(windowStart.getTime() + hoursVisible * HOUR_MS),
    [windowStart, hoursVisible],
  )

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLineups(null)
    ;(async () => {
      try {
        const numbers = await channelsApi.numbers()
        const entries = await Promise.all(
          numbers.map(async (n) => [n, await guideApi.channelLineup(n, windowStart, windowEnd)] as const),
        )
        if (cancelled) return
        setLineups(Object.fromEntries(entries))
      } catch (e) {
        if (!cancelled) toast.error(`Failed to load guide: ${e}`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [windowStart, windowEnd])

  function shiftWindow(hours: number) {
    setWindowStart((prev) => new Date(prev.getTime() + hours * HOUR_MS))
  }

  const totalMs = windowEnd.getTime() - windowStart.getTime()
  const nowPercent = ((now.getTime() - windowStart.getTime()) / totalMs) * 100
  const showNowLine = nowPercent >= 0 && nowPercent <= 100

  const hourMarks = Array.from({ length: hoursVisible + 1 }, (_, i) => {
    const t = new Date(windowStart.getTime() + i * HOUR_MS)
    return { percent: (i / hoursVisible) * 100, label: t.toLocaleTimeString([], { hour: 'numeric' }) }
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Guide</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => shiftWindow(-hoursVisible)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" onClick={() => setWindowStart(roundDownToHour(new Date()))}>
            Now
          </Button>
          <Button variant="secondary" onClick={() => shiftWindow(hoursVisible)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select value={hoursVisible} onChange={(e) => setHoursVisible(Number(e.target.value))}>
            <option value={2}>2 hours</option>
            <option value={4}>4 hours</option>
            <option value={8}>8 hours</option>
            <option value={12}>12 hours</option>
          </Select>
        </div>
      </div>

      {lineups === null ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading guide…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="min-w-[900px]">
            <div className="relative flex border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <div className="w-48 shrink-0 border-r border-slate-200 px-3 py-2 font-medium dark:border-slate-800">
                Channel
              </div>
              <div className="relative flex-1">
                {hourMarks.map((m, i) => (
                  <span
                    key={i}
                    className="absolute top-0 -translate-x-1/2 border-l border-slate-200 px-1 py-2 dark:border-slate-800"
                    style={{ left: `${m.percent}%` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            {Object.entries(lineups).map(([numStr, lineup]) => {
              const number = Number(numStr)
              return (
                <div
                  key={number}
                  className="relative flex border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <div className="flex w-48 shrink-0 items-center gap-2 border-r border-slate-200 px-3 py-2 dark:border-slate-800">
                    {lineup?.icon && <img src={lineup.icon} alt="" className="h-6 w-6 rounded" />}
                    <span className="truncate text-sm">
                      {number} {lineup?.name ? `— ${lineup.name}` : ''}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <a href={`/video?channel=${number}`} target="_blank" rel="noreferrer" title="Watch">
                        <Play className="h-3.5 w-3.5 text-slate-400 hover:text-brand-600" />
                      </a>
                      <Link to={`/channels/${number}`} title="Edit channel">
                        <Settings2 className="h-3.5 w-3.5 text-slate-400 hover:text-brand-600" />
                      </Link>
                    </div>
                  </div>
                  <div className="relative min-h-[2.5rem] flex-1">
                    {showNowLine && (
                      <div
                        className="absolute inset-y-0 z-10 w-px bg-red-500"
                        style={{ left: `${nowPercent}%` }}
                      />
                    )}
                    {lineup?.programs.map((entry, i) => {
                      const start = new Date(entry.start).getTime()
                      const stop = new Date(entry.stop).getTime()
                      const left = ((start - windowStart.getTime()) / totalMs) * 100
                      const width = ((stop - start) / totalMs) * 100
                      return (
                        <button
                          key={i}
                          onClick={() => setSelected({ channel: number, entry })}
                          className="absolute inset-y-1 overflow-hidden rounded border border-slate-300 bg-white px-2 text-left text-xs hover:border-brand-500 dark:border-slate-700 dark:bg-slate-800"
                          style={{ left: `${Math.max(0, left)}%`, width: `${width}%` }}
                          title={entry.title}
                        >
                          <span className="truncate">{entry.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">{selected.entry.title}</h3>
            {selected.entry.sub && (
              <p className="text-sm text-slate-500">
                S{String(selected.entry.sub.season).padStart(2, '0')}E
                {String(selected.entry.sub.episode).padStart(2, '0')} — {selected.entry.sub.title}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              {new Date(selected.entry.start).toLocaleString()} –{' '}
              {new Date(selected.entry.stop).toLocaleTimeString()}
            </p>
            {selected.entry.summary && <p className="mt-2 text-sm">{selected.entry.summary}</p>}
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
