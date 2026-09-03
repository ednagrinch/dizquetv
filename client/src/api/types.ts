// Shapes mirror what src/database-migration.js and src/api.js actually
// store/return. dizqueTV's "database" is untyped JSON, so these are kept
// permissive (index signature) rather than pretending the server enforces
// a strict schema it doesn't.

export interface FfmpegSettings {
  _id?: string
  configVersion: number
  ffmpegPath: string
  ffmpegPathLockDate?: number
  lock?: boolean
  addLock?: boolean
  threads: number
  concatMuxDelay: string
  logFfmpeg: boolean
  enableFFMPEGTranscoding: boolean
  audioVolumePercent: number
  videoEncoder: string
  audioEncoder: string
  vaapiDevice: string
  targetResolution: string
  videoBitrate: number
  videoBufSize: number
  audioBitrate: number
  audioBufSize: number
  audioSampleRate: number
  audioChannels: number
  errorScreen: 'pic' | 'blank' | 'static' | 'testsrc' | 'text' | 'kill'
  errorAudio: 'whitenoise' | 'sine' | 'silent'
  normalizeVideoCodec: boolean
  normalizeAudioCodec: boolean
  normalizeResolution: boolean
  normalizeAudio: boolean
  disablePreludes?: boolean
  maxFPS: number
  scalingAlgorithm: 'fast_bilinear' | 'bicubic' | 'lanczos' | 'spline'
  deinterlaceFilter: string
  [key: string]: unknown
}

export interface PlexSettings {
  _id?: string
  streamPath: string
  debugLogging: boolean
  directStreamBitrate: string
  transcodeBitrate: string
  mediaBufferSize: number
  transcodeMediaBufferSize: number
  maxPlayableResolution: string
  maxTranscodeResolution: string
  videoCodecs: string
  audioCodecs: string
  maxAudioChannels: string
  audioBoost: string
  enableSubtitles: boolean
  subtitleSize: string
  updatePlayStatus: boolean
  streamProtocol: string
  forceDirectPlay: boolean
  pathReplace: string
  pathReplaceWith: string
  [key: string]: unknown
}

export interface PlexServer {
  _id?: string
  name: string
  uri: string
  accessToken: string
  arGuide: boolean
  arChannels: boolean
  index: number
  [key: string]: unknown
}

export interface XmltvSettings {
  _id?: string
  cache: number
  refresh: number
  enableImageCache?: boolean
  file: string
  [key: string]: unknown
}

export interface HdhrSettings {
  _id?: string
  tunerCount: number
  autoDiscovery: boolean
  [key: string]: unknown
}

export interface VersionInfo {
  dizquetv: string
  ffmpeg: string
  nodejs: string
}
