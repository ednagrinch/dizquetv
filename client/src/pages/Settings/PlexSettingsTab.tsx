import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, Trash2, Wifi } from 'lucide-react'
import { plexServersApi, plexSettingsApi } from '../../api'
import type { PlexServer, PlexSettings } from '../../api/types'
import { useSettingsForm } from '../../hooks/useSettingsForm'
import { Button, Card, Field, Select, Switch, TextInput } from '../../components/ui'
import PlexServerDialog from './PlexServerDialog'

function ServerList() {
  const [servers, setServers] = useState<PlexServer[] | null>(null)
  const [editing, setEditing] = useState<PlexServer | null | undefined>(undefined)
  const [checking, setChecking] = useState<string | null>(null)

  function refresh() {
    plexServersApi
      .list()
      .then((list) => setServers(list.sort((a, b) => a.index - b.index)))
      .catch((e) => toast.error(`Failed to load Plex servers: ${e}`))
  }

  useEffect(refresh, [])

  async function remove(server: PlexServer) {
    if (!confirm(`Remove Plex server "${server.name}"? Programs from it will be marked offline.`)) return
    try {
      await plexServersApi.remove(server.name)
      toast.success(`Removed "${server.name}".`)
      refresh()
    } catch (e) {
      toast.error(`Failed to remove server: ${e}`)
    }
  }

  async function check(server: PlexServer) {
    setChecking(server.name)
    try {
      const result = await plexServersApi.checkStatus(server.name)
      toast.info(`${server.name}: ${result.status >= 0 ? 'online' : 'unreachable'}`)
    } catch (e) {
      toast.error(`Failed to check status: ${e}`)
    } finally {
      setChecking(null)
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Plex servers</h2>
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Add server
        </Button>
      </div>

      {servers === null ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : servers.length === 0 ? (
        <p className="text-sm text-slate-500">No Plex servers configured yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {servers.map((s) => (
            <li key={s.name} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-slate-500">{s.uri}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  loading={checking === s.name}
                  onClick={() => check(s)}
                  title="Check connection"
                >
                  <Wifi className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => setEditing(s)} title="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => remove(s)} title="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== undefined && (
        <PlexServerDialog
          server={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            refresh()
          }}
        />
      )}
    </Card>
  )
}

export default function PlexSettingsTab() {
  const { value, set, submit, loading, saving } = useSettingsForm<PlexSettings>(
    plexSettingsApi.get,
    plexSettingsApi.update,
  )

  return (
    <div className="flex flex-col gap-6">
      <ServerList />

      {loading || !value ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <Card className="flex flex-col gap-4">
            <h2 className="font-semibold">Playback</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Stream protocol">
                <Select
                  value={value.streamProtocol}
                  onChange={(e) => set('streamProtocol', e.target.value)}
                >
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                </Select>
              </Field>
              <Field label="Stream path">
                <Select value={value.streamPath} onChange={(e) => set('streamPath', e.target.value)}>
                  <option value="plex">Plex (proxied through Plex)</option>
                  <option value="direct">Direct (straight to the file)</option>
                </Select>
              </Field>
              <Field label="Direct stream bitrate (kb/s)">
                <TextInput
                  value={value.directStreamBitrate}
                  onChange={(e) => set('directStreamBitrate', e.target.value)}
                />
              </Field>
              <Field label="Transcode bitrate (kb/s)">
                <TextInput
                  value={value.transcodeBitrate}
                  onChange={(e) => set('transcodeBitrate', e.target.value)}
                />
              </Field>
              <Field label="Media buffer size (kb)">
                <TextInput
                  type="number"
                  value={value.mediaBufferSize}
                  onChange={(e) => set('mediaBufferSize', Number(e.target.value))}
                />
              </Field>
              <Field label="Transcode media buffer size (kb)">
                <TextInput
                  type="number"
                  value={value.transcodeMediaBufferSize}
                  onChange={(e) => set('transcodeMediaBufferSize', Number(e.target.value))}
                />
              </Field>
              <Field label="Max playable resolution">
                <TextInput
                  value={value.maxPlayableResolution}
                  onChange={(e) => set('maxPlayableResolution', e.target.value)}
                />
              </Field>
              <Field label="Max transcode resolution">
                <TextInput
                  value={value.maxTranscodeResolution}
                  onChange={(e) => set('maxTranscodeResolution', e.target.value)}
                />
              </Field>
              <Field label="Video codecs" hint="Comma-separated, preference order.">
                <TextInput value={value.videoCodecs} onChange={(e) => set('videoCodecs', e.target.value)} />
              </Field>
              <Field label="Audio codecs" hint="Comma-separated, preference order.">
                <TextInput value={value.audioCodecs} onChange={(e) => set('audioCodecs', e.target.value)} />
              </Field>
              <Field label="Max audio channels">
                <TextInput
                  value={value.maxAudioChannels}
                  onChange={(e) => set('maxAudioChannels', e.target.value)}
                />
              </Field>
              <Field label="Audio boost">
                <TextInput value={value.audioBoost} onChange={(e) => set('audioBoost', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Force direct play">
                <Switch checked={value.forceDirectPlay} onCheckedChange={(v) => set('forceDirectPlay', v)} />
              </Field>
              <Field label="Enable subtitles">
                <Switch checked={value.enableSubtitles} onCheckedChange={(v) => set('enableSubtitles', v)} />
              </Field>
              <Field label="Report play status to Plex">
                <Switch checked={value.updatePlayStatus} onCheckedChange={(v) => set('updatePlayStatus', v)} />
              </Field>
            </div>
            {value.enableSubtitles && (
              <Field label="Subtitle size (%)">
                <TextInput value={value.subtitleSize} onChange={(e) => set('subtitleSize', e.target.value)} />
              </Field>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="font-semibold">Advanced</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Path replace" hint="Search string for remapping Plex file paths.">
                <TextInput value={value.pathReplace} onChange={(e) => set('pathReplace', e.target.value)} />
              </Field>
              <Field label="Path replace with">
                <TextInput
                  value={value.pathReplaceWith}
                  onChange={(e) => set('pathReplaceWith', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Debug logging">
              <Switch checked={value.debugLogging} onCheckedChange={(v) => set('debugLogging', v)} />
            </Field>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => plexSettingsApi.reset(value._id).then(() => window.location.reload())}
            >
              Reset to defaults
            </Button>
            <Button onClick={submit} loading={saving}>
              Save changes
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
