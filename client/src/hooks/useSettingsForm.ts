import { useEffect, useState } from 'react'
import { toast } from 'sonner'

// Shared load/edit/save lifecycle for the settings tabs — they all follow the
// same GET-on-mount, edit-locally, PUT/POST-to-save shape.
export function useSettingsForm<T extends object>(
  load: () => Promise<T>,
  save: (value: T) => Promise<unknown>,
) {
  const [value, setValue] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    load()
      .then((v) => {
        if (!cancelled) setValue(v)
      })
      .catch((e) => toast.error(`Failed to load settings: ${e}`))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set<K extends keyof T>(key: K, val: T[K]) {
    setValue((prev) => (prev ? { ...prev, [key]: val } : prev))
  }

  async function submit() {
    if (!value) return
    setSaving(true)
    try {
      const result = await save(value)
      toast.success('Settings saved.')
      if (result && typeof result === 'object') setValue(result as T)
    } catch (e) {
      toast.error(`Failed to save settings: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  return { value, set, submit, loading, saving }
}
