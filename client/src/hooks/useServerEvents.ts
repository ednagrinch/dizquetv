import { useEffect } from 'react'
import { toast } from 'sonner'

interface SettingsUpdateEvent {
  message: string
  module?: string
  level?: 'info' | 'warn' | 'warning' | 'danger' | string
  detail?: unknown
}

// Mirrors web/directives/toast-notifications.js: a single SSE channel
// (GET /api/events, src/services/event-service.js) pushes named events.
// "heartbeat" is just a keep-alive and is intentionally ignored here.
export function useServerEvents() {
  useEffect(() => {
    const source = new EventSource('/api/events')

    const onSettingsUpdate = (e: MessageEvent) => {
      const data = JSON.parse(e.data) as SettingsUpdateEvent
      if (data.level === 'danger') {
        toast.error(data.message)
      } else if (data.level === 'warn' || data.level === 'warning') {
        toast.warning(data.message)
      } else {
        toast.info(data.message)
      }
    }

    const onXmltv = () => {
      toast.info('TV guide (XMLTV) was refreshed.')
    }

    const onLifecycle = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { message?: string }
        toast.info(data.message ?? 'Server lifecycle event.')
      } catch {
        // ignore malformed payloads
      }
    }

    source.addEventListener('settings-update', onSettingsUpdate)
    source.addEventListener('xmltv', onXmltv)
    source.addEventListener('lifecycle', onLifecycle)

    return () => {
      source.removeEventListener('settings-update', onSettingsUpdate)
      source.removeEventListener('xmltv', onXmltv)
      source.removeEventListener('lifecycle', onLifecycle)
      source.close()
    }
  }, [])
}
