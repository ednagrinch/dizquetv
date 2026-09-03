import { Loader2, Lock, Unlock } from 'lucide-react'
import { ffmpegSettingsApi } from '../../api'
import type { FfmpegSettings } from '../../api/types'
import { useSettingsForm } from '../../hooks/useSettingsForm'
import { Button, Card, Field, Select, Switch, TextInput } from '../../components/ui'

export default function FfmpegSettingsTab() {
  const { value, set, submit, loading, saving } = useSettingsForm<FfmpegSettings>(
    ffmpegSettingsApi.get,
    ffmpegSettingsApi.update,
  )

  if (loading || !value) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">ffmpeg binary</h2>
        <Field
          label="ffmpeg path"
          hint={
            value.lock
              ? 'Locked for 24 hours after being set, as a security measure. Reset to unlock immediately.'
              : 'Absolute path to the ffmpeg executable.'
          }
        >
          <div className="flex gap-2">
            <TextInput
              className="flex-1"
              value={value.ffmpegPath}
              disabled={!!value.lock}
              onChange={(e) => set('ffmpegPath', e.target.value)}
            />
            <Button
              variant="secondary"
              type="button"
              onClick={() => set('addLock', !value.lock)}
              title={value.lock ? 'Path is locked' : 'Lock this path'}
            >
              {value.lock ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
          </div>
        </Field>
        <Field label="Threads">
          <TextInput
            type="number"
            min={1}
            value={value.threads}
            onChange={(e) => set('threads', Number(e.target.value))}
          />
        </Field>
        <Field label="Log ffmpeg output to console" hint="Useful for debugging streaming issues.">
          <Switch checked={value.logFfmpeg} onCheckedChange={(v) => set('logFfmpeg', v)} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">Transcoding</h2>
        <Field label="Enable ffmpeg transcoding" hint="Disabling this plays raw source files with no normalization.">
          <Switch
            checked={value.enableFFMPEGTranscoding}
            onCheckedChange={(v) => set('enableFFMPEGTranscoding', v)}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Video encoder">
            <TextInput value={value.videoEncoder} onChange={(e) => set('videoEncoder', e.target.value)} />
          </Field>
          <Field label="Audio encoder">
            <TextInput value={value.audioEncoder} onChange={(e) => set('audioEncoder', e.target.value)} />
          </Field>
          <Field label="Target resolution" hint="e.g. 1920x1080">
            <TextInput
              value={value.targetResolution}
              onChange={(e) => set('targetResolution', e.target.value)}
            />
          </Field>
          <Field label="Max FPS">
            <TextInput
              type="number"
              value={value.maxFPS}
              onChange={(e) => set('maxFPS', Number(e.target.value))}
            />
          </Field>
          <Field label="Video bitrate (kb/s)">
            <TextInput
              type="number"
              value={value.videoBitrate}
              onChange={(e) => set('videoBitrate', Number(e.target.value))}
            />
          </Field>
          <Field
            label="Video buffer size (kb)"
            hint="Larger reduces stutter risk but adds a little latency. ~2x bitrate is a good starting point."
          >
            <TextInput
              type="number"
              value={value.videoBufSize}
              onChange={(e) => set('videoBufSize', Number(e.target.value))}
            />
          </Field>
          <Field label="Audio bitrate (kb/s)">
            <TextInput
              type="number"
              value={value.audioBitrate}
              onChange={(e) => set('audioBitrate', Number(e.target.value))}
            />
          </Field>
          <Field label="Audio buffer size (kb)">
            <TextInput
              type="number"
              value={value.audioBufSize}
              onChange={(e) => set('audioBufSize', Number(e.target.value))}
            />
          </Field>
          <Field label="Audio channels">
            <TextInput
              type="number"
              value={value.audioChannels}
              onChange={(e) => set('audioChannels', Number(e.target.value))}
            />
          </Field>
          <Field label="Audio sample rate (kHz)">
            <TextInput
              type="number"
              value={value.audioSampleRate}
              onChange={(e) => set('audioSampleRate', Number(e.target.value))}
            />
          </Field>
          <Field label="Audio volume (%)">
            <TextInput
              type="number"
              value={value.audioVolumePercent}
              onChange={(e) => set('audioVolumePercent', Number(e.target.value))}
            />
          </Field>
          <Field label="Scaling algorithm">
            <Select
              value={value.scalingAlgorithm}
              onChange={(e) => set('scalingAlgorithm', e.target.value as FfmpegSettings['scalingAlgorithm'])}
            >
              <option value="fast_bilinear">fast_bilinear</option>
              <option value="bicubic">bicubic</option>
              <option value="lanczos">lanczos</option>
              <option value="spline">spline</option>
            </Select>
          </Field>
          <Field label="Deinterlace filter">
            <TextInput
              value={value.deinterlaceFilter}
              onChange={(e) => set('deinterlaceFilter', e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Normalize video codec">
            <Switch
              checked={value.normalizeVideoCodec}
              onCheckedChange={(v) => set('normalizeVideoCodec', v)}
            />
          </Field>
          <Field label="Normalize audio codec">
            <Switch
              checked={value.normalizeAudioCodec}
              onCheckedChange={(v) => set('normalizeAudioCodec', v)}
            />
          </Field>
          <Field label="Normalize resolution">
            <Switch
              checked={value.normalizeResolution}
              onCheckedChange={(v) => set('normalizeResolution', v)}
            />
          </Field>
          <Field label="Normalize audio (volume/channels/sample rate)">
            <Switch checked={value.normalizeAudio} onCheckedChange={(v) => set('normalizeAudio', v)} />
          </Field>
          <Field label="Disable preludes" hint="Skip the brief interlude screen between segments.">
            <Switch
              checked={!!value.disablePreludes}
              onCheckedChange={(v) => set('disablePreludes', v)}
            />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">Error handling</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Error screen">
            <Select
              value={value.errorScreen}
              onChange={(e) => set('errorScreen', e.target.value as FfmpegSettings['errorScreen'])}
            >
              <option value="pic">Picture</option>
              <option value="blank">Blank</option>
              <option value="static">Static noise</option>
              <option value="testsrc">Test pattern</option>
              <option value="text">Text</option>
              <option value="kill">Stop stream</option>
            </Select>
          </Field>
          <Field label="Error audio">
            <Select
              value={value.errorAudio}
              onChange={(e) => set('errorAudio', e.target.value as FfmpegSettings['errorAudio'])}
            >
              <option value="silent">Silent</option>
              <option value="whitenoise">White noise</option>
              <option value="sine">Sine tone</option>
            </Select>
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            await ffmpegSettingsApi.reset()
            window.location.reload()
          }}
        >
          Reset to defaults
        </Button>
        <Button onClick={submit} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  )
}
