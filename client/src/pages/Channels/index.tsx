import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { channelsApi, type ChannelDescription } from '../../api'
import { Button, Card, PageHeader } from '../../components/ui'

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelDescription[] | null>(null)

  function refresh() {
    channelsApi
      .numbers()
      .then((numbers) => Promise.all(numbers.map((n) => channelsApi.description(n))))
      .then((list) => setChannels(list.sort((a, b) => a.number - b.number)))
      .catch((e) => toast.error(`Failed to load channels: ${e}`))
  }

  useEffect(refresh, [])

  async function remove(channel: ChannelDescription) {
    if (!confirm(`Delete channel ${channel.number} - ${channel.name}? This cannot be undone.`)) return
    try {
      await channelsApi.remove(channel.number)
      toast.success(`Deleted channel ${channel.number}.`)
      refresh()
    } catch (e) {
      toast.error(`Failed to delete channel: ${e}`)
    }
  }

  const nextNumber = channels && channels.length > 0 ? Math.max(...channels.map((c) => c.number)) + 1 : 1

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Channels" />
        <Link to={`/channels/new?number=${nextNumber}`}>
          <Button>
            <Plus className="h-4 w-4" /> Add channel
          </Button>
        </Link>
      </div>

      <Card>
        {channels === null ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : channels.length === 0 ? (
          <p className="text-sm text-slate-500">No channels yet. Add one to get started.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {channels.map((c) => (
              <li key={c.number}>
                <Link
                  to={`/channels/${c.number}`}
                  className="flex items-center gap-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  {c.icon ? (
                    <img src={c.icon} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-slate-200 dark:bg-slate-700" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {c.number} — {c.name}
                      {c.stealth && <span className="ml-2 text-xs text-slate-400">(Stealth)</span>}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault()
                      remove(c)
                    }}
                    title="Delete channel"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
