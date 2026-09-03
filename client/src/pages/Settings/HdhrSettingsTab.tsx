import { Loader2 } from 'lucide-react'
import { hdhrSettingsApi } from '../../api'
import type { HdhrSettings } from '../../api/types'
import { useSettingsForm } from '../../hooks/useSettingsForm'
import { Button, Card, Field, Switch, TextInput } from '../../components/ui'

export default function HdhrSettingsTab() {
  const { value, set, submit, loading, saving } = useSettingsForm<HdhrSettings>(
    hdhrSettingsApi.get,
    hdhrSettingsApi.update,
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
        <h2 className="font-semibold">HDHomeRun tuner emulation</h2>
        <p className="text-sm text-slate-500">
          Lets Plex/other clients discover dizqueTV as a network tuner.
        </p>
        <Field label="Tuner count">
          <TextInput
            type="number"
            min={1}
            value={value.tunerCount}
            onChange={(e) => set('tunerCount', Number(e.target.value))}
          />
        </Field>
        <Field label="Auto discovery (SSDP)" hint="Broadcast this server so Plex can find it automatically.">
          <Switch checked={value.autoDiscovery} onCheckedChange={(v) => set('autoDiscovery', v)} />
        </Field>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => hdhrSettingsApi.reset().then(() => window.location.reload())}>
          Reset to defaults
        </Button>
        <Button onClick={submit} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  )
}
