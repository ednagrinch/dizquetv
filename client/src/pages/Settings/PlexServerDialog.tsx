import { useState } from 'react'
import { toast } from 'sonner'
import { plexServersApi } from '../../api'
import type { PlexServer } from '../../api/types'
import { Dialog } from '../../components/Dialog'
import { Button, Field, Switch, TextInput } from '../../components/ui'

export default function PlexServerDialog({
  server,
  onClose,
  onSaved,
}: {
  server: PlexServer | null
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = server === null
  const [form, setForm] = useState<Partial<PlexServer>>(
    server ?? { name: '', uri: '', accessToken: '', arGuide: false, arChannels: false },
  )
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  // The server-side request library rejects a bare hostname outright (no
  // scheme to guess a default from without risking a confusing new failure
  // in the other direction), so this is caught here instead of only
  // surfacing as a cryptic server crash log after saving.
  function validateUri(): boolean {
    if (!/^https?:\/\//i.test((form.uri ?? '').trim())) {
      toast.error('URI must start with http:// or https:// (e.g. http://192.168.1.10:32400).')
      return false
    }
    return true
  }

  async function testConnection() {
    if (!form.uri || !form.accessToken) {
      toast.error('Enter a URI and access token first.')
      return
    }
    if (!validateUri()) return
    setTesting(true)
    try {
      const result = await plexServersApi.checkForeignStatus(form)
      toast.info(result.status >= 0 ? 'Server reachable.' : 'Server did not respond.')
    } catch (e) {
      toast.error(`Could not reach server: ${e}`)
    } finally {
      setTesting(false)
    }
  }

  async function save() {
    if (!form.name || !form.uri) {
      toast.error('Name and URI are required.')
      return
    }
    if (!validateUri()) return
    setSaving(true)
    try {
      if (isNew) {
        await plexServersApi.add(form)
        toast.success(`Plex server "${form.name}" added.`)
      } else {
        await plexServersApi.update(form)
        toast.success(`Plex server "${form.name}" updated.`)
      }
      onSaved()
    } catch (e) {
      toast.error(`Failed to save Plex server: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={isNew ? 'Add Plex server' : `Edit ${server?.name}`}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="URI" hint="Must include http:// or https:// -- e.g. http://192.168.1.10:32400">
          <TextInput
            placeholder="http://192.168.1.10:32400"
            value={form.uri ?? ''}
            onChange={(e) => setForm({ ...form, uri: e.target.value })}
          />
        </Field>
        <Field label="Access token">
          <TextInput
            type="password"
            value={form.accessToken ?? ''}
            onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
          />
        </Field>
        <Field label="Include in TV guide" hint="Pull program data from this server into the guide.">
          <Switch
            checked={!!form.arGuide}
            onCheckedChange={(v) => setForm({ ...form, arGuide: v })}
          />
        </Field>
        <Field label="Auto-populate channels" hint="Let this server be used to auto-create channels.">
          <Switch
            checked={!!form.arChannels}
            onCheckedChange={(v) => setForm({ ...form, arChannels: v })}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" loading={testing} onClick={testConnection}>
            Test connection
          </Button>
          <Button loading={saving} onClick={save}>
            {isNew ? 'Add server' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
