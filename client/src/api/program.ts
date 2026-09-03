// A "program" is dizqueTV's unit of schedulable content: a Plex item (movie,
// episode, track) or a pseudo-item (flex/offline, a redirect to another
// channel, or a custom-show entry). The server stores these as untyped JSON
// (see src/dao/channel-db.js), so this mirrors usage found in
// web/directives/channel-config.js and src/services/get-show-data.js rather
// than a schema the server enforces.
export interface Program {
  isOffline?: boolean
  type?: 'movie' | 'episode' | 'track' | 'redirect' | string
  duration: number
  title?: string
  showTitle?: string
  season?: number
  episode?: number
  date?: string
  serverKey?: string
  key?: string
  ratingKey?: string
  plexFile?: string
  file?: string
  icon?: string
  summary?: string
  channel?: number // target channel number, when type === 'redirect'
  customShowId?: string
  customShowName?: string
  customOrder?: number
  shuffleOrder?: number
  err?: unknown
  [key: string]: unknown
}

export interface Watermark {
  enabled: boolean
  width: number
  verticalMargin: number
  horizontalMargin: number
  duration: number
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  url?: string
  animated?: boolean
  fixedSize?: boolean
}

export interface FillerCollectionRef {
  id: string
  weight: number
  cooldown: number
}

export interface ChannelTranscoding {
  targetResolution?: string
  videoBitrate?: number
  videoBufSize?: number
}

export interface Channel {
  number: number
  name: string
  icon: string
  iconWidth: number
  iconDuration: number
  iconPosition: string
  groupTitle: string
  startTime: string
  programs: Program[]
  watermark?: Watermark
  fillerCollections: FillerCollectionRef[]
  fillerRepeatCooldown: number
  guideFlexPlaceholder: string
  guideMinimumDurationSeconds: number
  disableFillerOverlay: boolean
  fallback: Program[]
  offlinePicture: string
  offlineSoundtrack: string
  offlineMode: 'pic' | 'clip'
  transcoding?: ChannelTranscoding
  duration?: number
  stealth?: boolean
  [key: string]: unknown
}

export interface FillerList {
  id: string
  name: string
  content: Program[]
  [key: string]: unknown
}

export interface CustomShow {
  id: string
  name: string
  content: Program[]
  [key: string]: unknown
}

export function defaultWatermark(): Watermark {
  return {
    enabled: true,
    width: 12,
    verticalMargin: 4,
    horizontalMargin: 4,
    duration: 0,
    position: 'bottom-right',
  }
}

export function newChannelDefaults(nextNumber: number, origin: string): Channel {
  return {
    number: nextNumber,
    name: `Channel ${nextNumber}`,
    icon: `${origin}/images/dizquetv.png`,
    iconWidth: 120,
    iconDuration: 60,
    iconPosition: '2',
    groupTitle: 'dizqueTV',
    startTime: new Date().toISOString(),
    programs: [],
    watermark: defaultWatermark(),
    fillerCollections: [],
    fillerRepeatCooldown: 30 * 60 * 1000,
    guideFlexPlaceholder: '',
    guideMinimumDurationSeconds: 5 * 60,
    disableFillerOverlay: true,
    fallback: [],
    offlinePicture: `${origin}/images/generic-offline-screen.png`,
    offlineSoundtrack: '',
    offlineMode: 'pic',
    transcoding: {},
  }
}
