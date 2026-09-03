import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { xmltvSettingsApi } from '../../api'
import type { XmltvSettings } from '../../api/types'
import { useSettingsForm } from '../../hooks/useSettingsForm'
import { Button, Card, Field, Switch, TextInput } from '../../components/ui'

export default function XmltvSettingsTab() {
  const { value, set, submit, loading, saving } = useSettingsForm<XmltvSettings>(
    xmltvSettingsApi.get,
    xmltvSettingsApi.update,
  )
  const [lastRefresh, setLastRefresh] = useState<number | undefined>()

  useEffect(() => {
    xmltvSettingsApi.lastRefresh().then((r) => setLastRefresh(r.value)).catch(() => {})
  }, [])

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
        <h2 className="font-semibold">TV Guide (XMLTV)</h2>
        <Field label="Output file path" hint="Where the generated xmltv.xml file is written on disk.">
          <TextInput value={value.file} disabled />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Guide duration (hours)" hint="How many hours of programming to include.">
            <TextInput
              type="number"
              value={value.cache}
              onChange={(e) => set('cache', Number(e.target.value))}
            />
          </Field>
          <Field label="Refresh interval (hours)" hint="How often to regenerate the guide.">
            <TextInput
              type="number"
              value={value.refresh}
              onChange={(e) => set('refresh', Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Cache program images" hint="Download and serve program artwork locally.">
          <Switch
            checked={!!value.enableImageCache}
            onCheckedChange={(v) => set('enableImageCache', v)}
          />
        </Field>
        {lastRefresh !== undefined && lastRefresh > 0 && (
          <p className="text-xs text-slate-500">
            Last refreshed: {new Date(lastRefresh).toLocaleString()}
          </p>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => xmltvSettingsApi.reset().then(() => window.location.reload())}>
          Reset to defaults
        </Button>
        <Button onClick={submit} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  )
}
