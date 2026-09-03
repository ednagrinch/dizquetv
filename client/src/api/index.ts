import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type {
  FfmpegSettings,
  HdhrSettings,
  PlexServer,
  PlexSettings,
  VersionInfo,
  XmltvSettings,
} from './types'
import type { Channel, CustomShow, FillerList, Program } from './program'
import type { RandomSlotSchedule, ScheduleResult, TimeSlotSchedule } from './schedule'

export const versionApi = {
  get: () => apiGet<VersionInfo>('/api/version'),
}

export interface ChannelDescription {
  number: number
  icon?: string
  name: string
  stealth?: boolean
}

export const channelsApi = {
  numbers: () => apiGet<number[]>('/api/channelNumbers'),
  description: (number: number) => apiGet<ChannelDescription>(`/api/channel/description/${number}`),
  get: (number: number) => apiGet<Channel>(`/api/channel/${number}`),
  getProgramless: (number: number) => apiGet<Omit<Channel, 'programs'>>(`/api/channel/programless/${number}`),
  create: (channel: Channel) => apiPost<{ number: number }>('/api/channel', channel),
  update: (channel: Channel) => apiPut<{ number: number }>('/api/channel', channel),
  remove: (number: number) => apiDelete<{ number: number }>('/api/channel', { number }),
}

export interface UploadedImage {
  status: boolean
  message: string
  data?: { name: string; mimetype: string; size: number; fileUrl: string }
}

export const uploadApi = {
  image: (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    return fetch('/api/upload/image', { method: 'POST', body: formData }).then(
      (r) => r.json() as Promise<UploadedImage>,
    )
  },
}

export const fillerApi = {
  list: () => apiGet<FillerList[]>('/api/fillers'),
  get: (id: string) => apiGet<FillerList>(`/api/filler/${id}`),
  create: (filler: Partial<FillerList>) => apiPut<{ id: string }>('/api/filler', filler),
  update: (id: string, filler: FillerList) => apiPost<void>(`/api/filler/${id}`, filler),
  remove: (id: string) => apiDelete<void>(`/api/filler/${id}`),
  channelsUsing: (id: string) => apiGet<{ number: number; name: string }[]>(`/api/filler/${id}/channels`),
}

export const showsApi = {
  list: () => apiGet<CustomShow[]>('/api/shows'),
  get: (id: string) => apiGet<CustomShow>(`/api/show/${id}`),
  create: (show: Partial<CustomShow>) => apiPut<{ id: string }>('/api/show', show),
  update: (id: string, show: CustomShow) => apiPost<void>(`/api/show/${id}`, show),
  remove: (id: string) => apiDelete<void>(`/api/show/${id}`),
}

export interface GuideStatus {
  lastUpdate: string
  channelNumbers: string[]
}

export interface GuideEntry {
  start: string
  stop: string
  title: string
  summary?: string
  date?: string
  rating?: string
  icon?: string
  sub?: { season: number; episode: number; title: string }
}

export interface ChannelLineup {
  icon: string
  name: string
  number: number
  programs: GuideEntry[]
}

export const guideApi = {
  status: () => apiGet<GuideStatus>('/api/guide/status'),
  channelLineup: (channelNumber: number, dateFrom: Date, dateTo: Date) =>
    apiGet<ChannelLineup | null>(
      `/api/guide/channels/${channelNumber}?dateFrom=${dateFrom.toISOString()}&dateTo=${dateTo.toISOString()}`,
    ),
}

// A 400 response (validation error, e.g. duplicate slot times) throws an
// ApiError whose .message is the server's plain-text userError — catch and
// surface that rather than expecting a {userError} field on the resolved value.
export const channelToolsApi = {
  timeSlots: (programs: Program[], schedule: TimeSlotSchedule) =>
    apiPost<ScheduleResult>('/api/channel-tools/time-slots', { programs, schedule }),
  randomSlots: (programs: Program[], schedule: RandomSlotSchedule) =>
    apiPost<ScheduleResult>('/api/channel-tools/random-slots', { programs, schedule }),
}

export const ffmpegSettingsApi = {
  get: () => apiGet<FfmpegSettings>('/api/ffmpeg-settings'),
  update: (settings: FfmpegSettings) => apiPut<FfmpegSettings>('/api/ffmpeg-settings', settings),
  reset: () => apiPost<FfmpegSettings>('/api/ffmpeg-settings'),
}

export const plexSettingsApi = {
  get: () => apiGet<PlexSettings>('/api/plex-settings'),
  update: (settings: PlexSettings) => apiPut<PlexSettings>('/api/plex-settings', settings),
  reset: (id?: string) => apiPost<PlexSettings>('/api/plex-settings', { _id: id }),
}

export const plexServersApi = {
  list: () => apiGet<PlexServer[]>('/api/plex-servers'),
  checkStatus: (name: string) =>
    apiPost<{ status: number }>('/api/plex-servers/status', { name }),
  // Used for a server that hasn't been saved yet (e.g. testing the add-server form).
  checkForeignStatus: (server: Partial<PlexServer>) =>
    apiPost<{ status: number }>('/api/plex-servers/foreignstatus', server),
  add: (server: Partial<PlexServer>) => apiPut<string>('/api/plex-servers', server),
  update: (server: Partial<PlexServer>) => apiPost<string>('/api/plex-servers', server),
  remove: (name: string) => apiDelete<string>('/api/plex-servers', { name }),
}

export const xmltvSettingsApi = {
  get: () => apiGet<XmltvSettings>('/api/xmltv-settings'),
  update: (settings: XmltvSettings) => apiPut<XmltvSettings>('/api/xmltv-settings', settings),
  reset: () => apiPost<XmltvSettings>('/api/xmltv-settings'),
  // The server double-encodes this one (res.send(JSON.stringify(...)) without
  // setting a JSON content-type), so it comes back as a JSON string, not a parsed body.
  lastRefresh: () =>
    apiGet<string>('/api/xmltv-last-refresh').then((raw) => JSON.parse(raw) as { value: number }),
}

export const hdhrSettingsApi = {
  get: () => apiGet<HdhrSettings>('/api/hdhr-settings'),
  update: (settings: HdhrSettings) => apiPut<HdhrSettings>('/api/hdhr-settings', settings),
  reset: () => apiPost<HdhrSettings>('/api/hdhr-settings'),
}
