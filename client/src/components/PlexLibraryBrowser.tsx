import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { ChevronRight, Film, Folder, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { plexServersApi } from '../api'
import type { PlexServer } from '../api/types'
import type { Program } from '../api/program'
import {
  listItems,
  listLibrarySections,
  type PlexContainerItem,
  type PlexPlayableItem,
  type PlexSection,
} from '../lib/plexBrowse'
import { formatDuration } from '../lib/programTools'
import { Button, Card, Select } from './ui'

export interface PlexLibraryBrowserProps {
  // Omit (or pass undefined) for read-only browsing -- Add buttons and
  // selection checkboxes are hidden when there's nothing to add to.
  onAdd?: (programs: Program[]) => void
}

// A branch row is either a top-level library section (movie/show/artist) or
// a container one level down inside it (show/season/artist/album).
type ContainerType = PlexSection['type'] | PlexContainerItem['type']

interface Crumb {
  title: string
  // null marks the root (the list of library sections).
  key: string | null
}

type Row =
  | { kind: 'branch'; key: string; title: string; type: ContainerType; icon?: string }
  | { kind: 'program'; key: string; program: Program }

const ROOT_CRUMB: Crumb = { title: 'Sections', key: null }

export default function PlexLibraryBrowser({ onAdd }: PlexLibraryBrowserProps) {
  const [servers, setServers] = useState<PlexServer[] | null>(null)
  const [serversError, setServersError] = useState<string | null>(null)
  const [serverName, setServerName] = useState<string>('')

  const [crumbs, setCrumbs] = useState<Crumb[]>([ROOT_CRUMB])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [refreshTick, setRefreshTick] = useState(0)
  const [addingWhole, setAddingWhole] = useState(false)

  const server = useMemo(() => servers?.find((s) => s.name === serverName) ?? null, [servers, serverName])
  const currentCrumb = crumbs[crumbs.length - 1]

  useEffect(() => {
    plexServersApi
      .list()
      .then((list) => {
        setServers(list)
        if (list.length > 0) setServerName(list[0].name)
      })
      .catch((e) => setServersError(`Failed to load Plex servers: ${e instanceof Error ? e.message : e}`))
  }, [])

  // Switching servers always goes back to the section list -- keys from one
  // server's library aren't meaningful on another.
  function selectServer(name: string) {
    setServerName(name)
    setCrumbs([ROOT_CRUMB])
  }

  useEffect(() => {
    if (!server) {
      setRows(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setSelected(new Set())

    const load =
      currentCrumb.key === null
        ? listLibrarySections(server).then(
            (sections): Row[] =>
              sections.map((s) => ({ kind: 'branch', key: s.key, title: s.title, type: s.type, icon: s.icon })),
          )
        : listItems(server, currentCrumb.key).then(
            (items): Row[] =>
              items.map((item) =>
                item.drillable
                  ? { kind: 'branch', key: item.key, title: item.title, type: item.type, icon: item.icon }
                  : {
                      kind: 'program',
                      key: item.program.key ?? item.program.ratingKey ?? item.program.title ?? '',
                      program: item.program,
                    },
              ),
          )

    load
      .then((r) => {
        if (!cancelled) setRows(r)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, currentCrumb.key, refreshTick])

  function drillInto(row: Row) {
    if (row.kind !== 'branch') return
    setCrumbs((c) => [...c, { title: row.title, key: row.key }])
  }

  function goToCrumb(index: number) {
    setCrumbs((c) => c.slice(0, index + 1))
  }

  function toggleSelected(key: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const programRows = useMemo(() => (rows ?? []).filter((r) => r.kind === 'program'), [rows])

  function selectAll() {
    setSelected(new Set(programRows.map((r) => r.key)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function addPrograms(programs: Program[]) {
    if (!onAdd || programs.length === 0) return
    onAdd(programs)
    toast.success(`Added ${programs.length} ${programs.length === 1 ? 'item' : 'items'} to the channel.`)
  }

  function addOne(program: Program) {
    addPrograms([program])
  }

  function addSelected() {
    const programs = programRows.filter((r) => selected.has(r.key)).map((r) => (r.kind === 'program' ? r.program : null))
    const filtered = programs.filter((p): p is Program => p !== null)
    addPrograms(filtered)
    clearSelection()
  }

  // Viewing a show's seasons or an artist's albums: fetch every child
  // container's contents and add the whole thing in one shot, instead of
  // forcing a click into each season/album individually. Checked against
  // the *rows themselves* rather than the current crumb -- a section is
  // also tagged type "show"/"artist" (a TV library vs. one specific show
  // use the same string), so only the rows unambiguously say whether
  // we're looking at a list of shows (don't offer this) or a list of one
  // show's seasons (do).
  const branchRows = useMemo(() => (rows ?? []).filter((r) => r.kind === 'branch'), [rows])
  const rowsContainerType = branchRows[0]?.type
  const wholeContainerLabel =
    rowsContainerType === 'season'
      ? 'Add entire series'
      : rowsContainerType === 'album'
        ? 'Add entire discography'
        : null

  async function addEntireContainer() {
    if (!server || !onAdd) return
    setAddingWhole(true)
    try {
      const childLists = await Promise.all(branchRows.map((child) => listItems(server, child.key)))
      const programs = childLists
        .flat()
        .filter((item): item is PlexPlayableItem => !item.drillable)
        .map((item) => item.program)
        .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0))
      if (programs.length === 0) {
        toast.error('No playable items found.')
        return
      }
      addPrograms(programs)
    } catch (e) {
      toast.error(`Failed to add: ${e instanceof Error ? e.message : e}`)
    } finally {
      setAddingWhole(false)
    }
  }

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 8,
  })

  const canAdd = typeof onAdd === 'function'

  if (serversError) {
    return (
      <Card className="flex items-start gap-3 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="text-sm text-red-800 dark:text-red-200">{serversError}</div>
      </Card>
    )
  }

  if (servers === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Plex servers…
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <Card className="text-sm text-slate-500 dark:text-slate-400">
        No Plex servers configured yet. Add one under Settings → Plex before browsing your library.
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {servers.length > 1 && (
            <Select
              value={serverName}
              onChange={(e) => selectServer(e.target.value)}
              className="w-auto min-w-[10rem]"
            >
              {servers.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}

          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                <button
                  disabled={i === crumbs.length - 1}
                  onClick={() => goToCrumb(i)}
                  className={
                    i === crumbs.length - 1
                      ? 'font-medium text-slate-800 dark:text-slate-100'
                      : 'text-brand-600 hover:underline'
                  }
                >
                  {c.title}
                </button>
              </span>
            ))}
          </nav>

          <Button variant="ghost" onClick={() => setRefreshTick((n) => n + 1)} title="Refresh this view">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {canAdd && wholeContainerLabel && branchRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              Add every item across all {branchRows.length} {rowsContainerType === 'season' ? 'seasons' : 'albums'}
              , without opening each one.
            </span>
            <Button loading={addingWhole} onClick={addEntireContainer}>
              {wholeContainerLabel}
            </Button>
          </div>
        )}

        {canAdd && programRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              {selected.size > 0 ? `${selected.size} selected` : 'Select items to add multiple at once'}
            </span>
            <Button variant="secondary" onClick={selectAll}>
              Select all in this view
            </Button>
            {selected.size > 0 && (
              <>
                <Button variant="ghost" onClick={clearSelection}>
                  Clear
                </Button>
                <Button onClick={addSelected}>Add {selected.size} selected</Button>
              </>
            )}
          </div>
        )}
      </Card>

      {error && (
        <Card className="flex items-start gap-3 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
        </Card>
      )}

      {!error && loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {!error && !loading && rows !== null && rows.length === 0 && (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Nothing to show here.</Card>
      )}

      {!error && !loading && rows !== null && rows.length > 0 && (
        // Not <Card> here: Card's default p-5 padding can't be reliably
        // overridden via an appended className (Tailwind's cascade order
        // isn't determined by class string order), and this list wants
        // edge-to-edge rows with padding applied per-row instead.
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div ref={parentRef} className="max-h-[32rem] overflow-y-auto">
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vi) => {
                // Non-null assertion is safe here: this block only renders
                // once the enclosing `rows !== null` check above has passed,
                // and `rows` (state) can't change mid-render.
                const row = rows![vi.index]
                return (
                  <div
                    key={row.key || vi.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: vi.size,
                      transform: `translateY(${vi.start}px)`,
                    }}
                    className="flex items-center gap-3 border-b border-slate-100 px-4 last:border-b-0 dark:border-slate-800"
                  >
                    {row.kind === 'program' && canAdd && (
                      <input
                        type="checkbox"
                        checked={selected.has(row.key)}
                        onChange={() => toggleSelected(row.key)}
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
                      />
                    )}

                    <Thumb icon={row.kind === 'program' ? row.program.icon : row.icon} branch={row.kind === 'branch'} />

                    {row.kind === 'branch' ? (
                      <button
                        onClick={() => drillInto(row)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 text-left"
                      >
                        <span className="truncate text-sm font-medium">{row.title}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </button>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{row.program.title}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {formatDuration(row.program.duration)}
                          </p>
                        </div>
                        {canAdd && (
                          <Button variant="secondary" onClick={() => addOne(row.program)}>
                            Add
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Thumb({ icon, branch }: { icon?: string; branch: boolean }) {
  const [failed, setFailed] = useState(false)

  if (!icon || failed) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400 dark:bg-slate-800">
        {branch ? <Folder className="h-5 w-5" /> : <Film className="h-5 w-5" />}
      </div>
    )
  }

  return (
    <img
      src={icon}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded object-cover"
    />
  )
}
