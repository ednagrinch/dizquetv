import { useEffect, useState } from 'react'
import { Play, Loader2 } from 'lucide-react'
import { channelsApi, type ChannelDescription } from '../api'
import { Button, Card, Field, PageHeader, Select } from '../components/ui'

type EndpointId = 'video' | 'm3u8' | 'radio'

const endpointOptions: { id: EndpointId; description: string; help: string }[] = [
  {
    id: 'video',
    description: '/video - Channel mpegts',
    help: "The /video endpoint is the one used by IPTV players or Plex to play the channel's content. It creates a single mpegts stream out of all the scheduled videos, so it needs them normalized to the same codec/resolution. Use this to debug Plex/IPTV player issues.",
  },
  {
    id: 'm3u8',
    description: '/m3u8 - Playlist of individual videos',
    help: 'The /m3u8 endpoint (misnomer) sends the channel as a playlist of videos, letting some players play the channel in sequence without needing a single stream — so it requires less normalization.',
  },
  {
    id: 'radio',
    description: '/radio - Audio-only channel mpegts',
    help: 'The /radio endpoint plays only the audio, turning the channel into a radio station. If you only need audio, this is far more efficient since no video needs to be extracted or transcoded.',
  },
]

const mediaPlayerPath: Record<EndpointId, (channel: number) => string> = {
  video: (c) => `./media-player/${c}.m3u`,
  m3u8: (c) => `./media-player/fast/${c}.m3u`,
  radio: (c) => `./media-player/radio/${c}.m3u`,
}

const streamPath: Record<EndpointId, (channel: number) => string> = {
  video: (c) => `/video?channel=${c}`,
  m3u8: (c) => `/m3u8?channel=${c}`,
  radio: (c) => `/radio?channel=${c}`,
}

export default function PlayerPage() {
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState<ChannelDescription[]>([])
  const [channel, setChannel] = useState<number | undefined>(undefined)
  const [endpoint, setEndpoint] = useState<EndpointId>('video')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const numbers = await channelsApi.numbers()
        const descriptions = await Promise.all(numbers.map((n) => channelsApi.description(n)))
        if (cancelled) return
        descriptions.sort((a, b) => a.number - b.number)
        setChannels(descriptions)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const active = endpointOptions.find((o) => o.id === endpoint)!
  const url = channel === undefined ? '--' : `${window.location.origin}${streamPath[endpoint](channel)}`

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Player"
        description="Play your channels in a local media player. Mostly for testing and to show what endpoints are available."
      />
      <Card className="flex flex-col gap-4">
        <Field label="Channel">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading channels…
            </div>
          ) : channels.length === 0 ? (
            <p className="text-sm text-slate-500">No channels found.</p>
          ) : (
            <Select
              value={channel ?? ''}
              onChange={(e) => setChannel(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Select a channel</option>
              {channels.map((c) => (
                <option key={c.number} value={c.number}>
                  {c.number} - {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Endpoint" hint={active.help}>
          <Select value={endpoint} onChange={(e) => setEndpoint(e.target.value as EndpointId)}>
            {endpointOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.description}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="URL to play">
          <input
            readOnly
            value={url}
            className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </Field>

        {channel !== undefined && (
          <a href={mediaPlayerPath[endpoint](channel)}>
            <Button>
              <Play className="h-4 w-4" /> Play in local media player
            </Button>
          </a>
        )}
      </Card>
    </div>
  )
}
