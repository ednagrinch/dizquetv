import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { versionApi } from '../api'
import type { VersionInfo } from '../api/types'
import { Card, PageHeader } from '../components/ui'

export default function VersionPage() {
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    versionApi.get().then(setInfo).catch((e) => setError(String(e)))
  }, [])

  return (
    <div className="max-w-md">
      <PageHeader title="Version" />
      <Card>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !info ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-medium text-slate-500">dizqueTV</dt>
            <dd>{info.dizquetv}</dd>
            <dt className="font-medium text-slate-500">ffmpeg</dt>
            <dd>{info.ffmpeg}</dd>
            <dt className="font-medium text-slate-500">Node.js</dt>
            <dd>{info.nodejs}</dd>
          </dl>
        )}
      </Card>
    </div>
  )
}
