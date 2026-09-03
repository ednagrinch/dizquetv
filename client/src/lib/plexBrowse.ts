// Direct-to-Plex-Media-Server browser fetch layer.
//
// IMPORTANT / RISKIEST ASSUMPTION IN THIS FILE:
// Just like the old AngularJS app (see web/services/plex.js), this talks
// straight from the browser to the user's Plex Media Server at
// `server.uri`, NOT through the dizqueTV backend. That only works because
// Plex Media Server sends permissive CORS headers on its HTTP API. This has
// not been verified against a real Plex Media Server in this rewrite --
// confirm CORS behavior (and that `server.uri` is actually reachable from
// the browser, which may differ from being reachable from the dizqueTV
// server) before relying on this in production.
//
// Ported from src/plex.js's `Get()` (which unwraps `res.MediaContainer` for
// callers) and web/services/plex.js's `getLibrary`/`getNested`.

import type { Program } from '../api/program'
import type { PlexServer } from '../api/types'

export interface PlexSection {
  title: string
  key: string
  icon: string
  type: 'movie' | 'show' | 'artist'
}

// A container is a browsable node that isn't directly playable -- clicking
// it should call listItems() again with its `key`.
export interface PlexContainerItem {
  drillable: true
  title: string
  key: string
  type: 'show' | 'season' | 'artist' | 'album'
  icon?: string
}

// A playable item wraps a full Program, ready to hand to onAdd / a channel.
export interface PlexPlayableItem {
  drillable: false
  program: Program
}

export type PlexBrowseItem = PlexContainerItem | PlexPlayableItem

interface PlexMediaPart {
  key?: string
  file?: string
}

interface PlexMedia {
  Part?: PlexMediaPart[]
}

// Loosely typed raw Plex metadata -- Plex's actual JSON has many more fields
// than we care about here, and dizqueTV has never enforced a schema on
// server responses (see the comment atop src/api/program.ts).
interface PlexMetadataRaw {
  title: string
  key: string
  ratingKey: string
  type: string
  duration?: number
  summary?: string
  thumb?: string
  grandparentTitle?: string
  parentIndex?: number
  index?: number
  Media?: PlexMedia[]
  [key: string]: unknown
}

interface PlexDirectoryRaw {
  title: string
  key: string
  type: string
  composite?: string
  thumb?: string
  [key: string]: unknown
}

interface PlexMediaContainer {
  Directory?: PlexDirectoryRaw[]
  Metadata?: PlexMetadataRaw[]
  [key: string]: unknown
}

function trimTrailingSlash(uri: string): string {
  return uri.endsWith('/') ? uri.slice(0, -1) : uri
}

function buildIconUrl(server: PlexServer, path: string | undefined): string | undefined {
  if (!path) return undefined
  return `${trimTrailingSlash(server.uri)}${path}?X-Plex-Token=${server.accessToken}`
}

// Fetches `path` on the given Plex server and returns the unwrapped
// MediaContainer, mirroring src/plex.js's Get(). Throws a clear, UI-safe
// Error on network failure (including CORS blocks), non-2xx responses, or
// unparseable bodies -- never lets a raw fetch rejection or JSON parse
// error bubble up.
async function plexGet(server: PlexServer, path: string): Promise<PlexMediaContainer> {
  const url = `${trimTrailingSlash(server.uri)}${path}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Plex-Token': server.accessToken,
      },
    })
  } catch (err) {
    throw new Error(
      `Could not reach Plex server "${server.name}" (${server.uri}) directly from your browser. ` +
        `Library browsing talks straight to the Plex server, not through dizqueTV -- make sure ` +
        `${server.uri} is reachable from the machine you're using right now, not just from the ` +
        `dizqueTV server, and that nothing (CORS, a firewall, HTTPS/mixed-content) is blocking it. ` +
        `(${err instanceof Error ? err.message : String(err)})`,
    )
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Plex server "${server.name}" rejected the request (${res.status}). The saved Plex token may be invalid or expired.`,
      )
    }
    throw new Error(`Plex server "${server.name}" returned ${res.status} ${res.statusText} for ${path}.`)
  }

  try {
    const body = (await res.json()) as { MediaContainer?: PlexMediaContainer }
    return body.MediaContainer ?? {}
  } catch (err) {
    throw new Error(
      `Plex server "${server.name}" returned an unexpected (non-JSON) response for ${path}. (${
        err instanceof Error ? err.message : String(err)
      })`,
    )
  }
}

// GET /library/sections -- the top-level list of libraries (Movies, TV
// Shows, Music, ...). Only movie/show/artist sections are browsable here;
// photo libraries etc. are filtered out, same as the old client.
export async function listLibrarySections(server: PlexServer): Promise<PlexSection[]> {
  const container = await plexGet(server, '/library/sections')
  const directories = container.Directory ?? []
  const sections: PlexSection[] = []

  for (const dir of directories) {
    if (dir.type === 'movie' || dir.type === 'show' || dir.type === 'artist') {
      sections.push({
        title: dir.title,
        key: `/library/sections/${dir.key}/all`,
        icon: buildIconUrl(server, dir.composite) ?? '',
        type: dir.type,
      })
    }
  }

  return sections
}

const CONTAINER_TYPES = new Set(['show', 'season', 'artist', 'album'])
const PLAYABLE_TYPES = new Set(['movie', 'episode', 'track'])

// GET {key} -- lists the contents of a section, a show (-> seasons), a
// season (-> episodes), an artist (-> albums), or an album (-> tracks). The
// same shape is reused recursively for drill-down, matching the old
// getNested()'s behavior.
export async function listItems(server: PlexServer, key: string): Promise<PlexBrowseItem[]> {
  const container = await plexGet(server, key)
  const metadata = container.Metadata ?? []
  const items: PlexBrowseItem[] = []

  for (const meta of metadata) {
    if (CONTAINER_TYPES.has(meta.type)) {
      items.push({
        drillable: true,
        title: meta.title,
        key: meta.key,
        type: meta.type as PlexContainerItem['type'],
        icon: buildIconUrl(server, meta.thumb),
      })
      continue
    }

    if (!PLAYABLE_TYPES.has(meta.type)) {
      continue
    }

    // Skip anything without a usable duration -- can't schedule it.
    if (typeof meta.duration !== 'number' || meta.duration <= 0) {
      continue
    }

    const part = meta.Media?.[0]?.Part?.[0]

    const program: Program = {
      title: meta.title,
      key: meta.key,
      ratingKey: meta.ratingKey,
      type: meta.type,
      duration: meta.duration,
      summary: meta.summary,
      icon: buildIconUrl(server, meta.thumb),
      serverKey: server.name,
      plexFile: part?.key,
      file: part?.file,
    }

    if (meta.type === 'episode') {
      program.showTitle = meta.grandparentTitle
      program.episode = meta.index
      program.season = meta.parentIndex
    } else if (meta.type === 'movie') {
      program.showTitle = meta.title
      program.episode = 1
      program.season = 1
    } else if (meta.type === 'track') {
      // The old client fetches the parent album to backfill showTitle/year;
      // skipped here as non-essential (per the port's scope) -- fall back to
      // the track's own title.
      program.showTitle = meta.title
    }

    items.push({ drillable: false, program })
  }

  return items
}
