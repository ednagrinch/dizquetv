import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeft, Calendar, Dices, Loader2, Shuffle, Trash2, Upload } from 'lucide-react'
import { channelsApi, fillerApi, uploadApi } from '../../api'
import type { Channel, FillerCollectionRef, FillerList, Program } from '../../api/program'
import { defaultWatermark, newChannelDefaults } from '../../api/program'
import { removeDuplicates, sortShows } from '../../lib/programTools'
import { Button, Card, Field, PageHeader, Select, Switch, Tabs, TabsContent, TabsList, TabsTrigger, TextInput } from '../../components/ui'
import { Dialog } from '../../components/Dialog'
import ProgramListItem from './ProgramListItem'
import PlexLibraryBrowser from '../../components/PlexLibraryBrowser'
import TimeSlotsEditorDialog from '../../components/TimeSlotsEditorDialog'
import RandomSlotsEditorDialog from '../../components/RandomSlotsEditorDialog'
import type { TimeSlotSchedule, RandomSlotSchedule } from '../../api/schedule'

export default function ChannelEditor() {
  const { number } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNew = number === 'new'

  const [channel, setChannel] = useState<Channel | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showTimeSlots, setShowTimeSlots] = useState(false)
  const [showRandomSlots, setShowRandomSlots] = useState(false)
  const [fillerLists, setFillerLists] = useState<FillerList[]>([])

  useEffect(() => {
    fillerApi.list().then(setFillerLists).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    if (isNew) {
      const suggested = Number(searchParams.get('number') ?? '1')
      setChannel(newChannelDefaults(suggested, window.location.origin))
      setLoading(false)
    } else {
      channelsApi
        .get(Number(number))
        .then((loaded) =>
          setChannel({
            ...loaded,
            watermark: loaded.watermark ?? defaultWatermark(),
            fillerCollections: loaded.fillerCollections ?? [],
            fallback: loaded.fallback ?? [],
          }),
        )
        .catch((e) => toast.error(`Failed to load channel: ${e}`))
        .finally(() => setLoading(false))
    }
  }, [number, isNew, searchParams])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const programIds = useMemo(
    () => (channel?.programs ?? []).map((_, i) => String(i)),
    [channel?.programs],
  )

  function update<K extends keyof Channel>(key: K, value: Channel[K]) {
    setChannel((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function setPrograms(programs: Program[]) {
    setChannel((prev) => (prev ? { ...prev, programs } : prev))
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!channel) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = Number(active.id)
    const newIndex = Number(over.id)
    setPrograms(arrayMove(channel.programs, oldIndex, newIndex))
  }

  async function save() {
    if (!channel) return
    if (!channel.name.trim()) {
      toast.error('Channel name is required.')
      return
    }
    setSaving(true)
    try {
      if (isNew) {
        await channelsApi.create(channel)
        toast.success(`Channel ${channel.number} created.`)
      } else {
        await channelsApi.update(channel)
        toast.success(`Channel ${channel.number} saved.`)
      }
      navigate('/channels')
    } catch (e) {
      toast.error(`Failed to save channel: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  async function uploadIconTo(field: 'icon' | 'offlinePicture' | 'watermark.url', file: File) {
    try {
      const result = await uploadApi.image(file)
      if (!result.status || !result.data) {
        toast.error(result.message || 'Upload failed.')
        return
      }
      const url = result.data.fileUrl
      if (field === 'watermark.url') {
        setChannel((prev) => (prev ? { ...prev, watermark: { ...prev.watermark!, url } } : prev))
      } else if (field === 'icon') {
        setChannel((prev) => (prev ? { ...prev, icon: url } : prev))
      } else {
        setChannel((prev) => (prev ? { ...prev, offlinePicture: url } : prev))
      }
    } catch (e) {
      toast.error(`Upload failed: ${e}`)
    }
  }

  if (loading || !channel) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/channels')}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <PageHeader title={isNew ? 'Add channel' : `Edit channel ${channel.number}`} />
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="programs">Programs ({channel.programs.length})</TabsTrigger>
          <TabsTrigger value="filler">Filler &amp; Flex</TabsTrigger>
          <TabsTrigger value="watermark">Watermark</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Number">
                <TextInput
                  type="number"
                  value={channel.number}
                  disabled={!isNew}
                  onChange={(e) => update('number', Number(e.target.value))}
                />
              </Field>
              <Field label="Name">
                <TextInput value={channel.name} onChange={(e) => update('name', e.target.value)} />
              </Field>
              <Field label="Group title" hint="Used for grouping in M3U/guide exports.">
                <TextInput value={channel.groupTitle} onChange={(e) => update('groupTitle', e.target.value)} />
              </Field>
              <Field label="Stealth" hint="Hide from the auto-generated guide/HDHomeRun listing.">
                <Switch checked={!!channel.stealth} onCheckedChange={(v) => update('stealth', v)} />
              </Field>
            </div>
            <Field label="Icon">
              <div className="flex items-center gap-3">
                {channel.icon && <img src={channel.icon} alt="" className="h-12 w-12 rounded object-cover" />}
                <TextInput
                  className="flex-1"
                  value={channel.icon}
                  onChange={(e) => update('icon', e.target.value)}
                />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadIconTo('icon', e.target.files[0])}
                  />
                  <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">
                    <Upload className="h-4 w-4" /> Upload
                  </span>
                </label>
              </div>
            </Field>
          </Card>
        </TabsContent>

        <TabsContent value="programs">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setShowLibrary(true)}>Add from Plex library</Button>
              <Button variant="secondary" onClick={() => setShowTimeSlots(true)}>
                <Calendar className="h-4 w-4" /> Time slots…
              </Button>
              <Button variant="secondary" onClick={() => setShowRandomSlots(true)}>
                <Dices className="h-4 w-4" /> Random slots…
              </Button>
              <Button variant="secondary" onClick={() => setPrograms(sortShows(channel.programs))}>
                Sort by show
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const copy = channel.programs.slice()
                  for (let i = copy.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1))
                    ;[copy[i], copy[j]] = [copy[j], copy[i]]
                  }
                  setPrograms(copy)
                }}
              >
                <Shuffle className="h-4 w-4" /> Shuffle
              </Button>
              <Button variant="secondary" onClick={() => setPrograms(removeDuplicates(channel.programs))}>
                Remove duplicates
              </Button>
              <Button
                variant="danger"
                onClick={() => confirm('Remove all programs from this channel?') && setPrograms([])}
              >
                <Trash2 className="h-4 w-4" /> Clear all
              </Button>
            </div>

            {channel.programs.length === 0 ? (
              <p className="text-sm text-slate-500">
                No programs yet. Add some from your Plex library, or use the time-slot/random-slot tools.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={programIds} strategy={verticalListSortingStrategy}>
                  <ul className="max-h-[32rem] overflow-y-auto">
                    {channel.programs.map((p, i) => (
                      <ProgramListItem
                        key={i}
                        id={String(i)}
                        program={p}
                        onRemove={() => setPrograms(channel.programs.filter((_, j) => j !== i))}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="filler">
          <FillerAndFlexTab channel={channel} fillerLists={fillerLists} update={update} />
        </TabsContent>

        <TabsContent value="watermark">
          <WatermarkTab channel={channel} setChannel={setChannel} uploadIconTo={uploadIconTo} />
        </TabsContent>

        <TabsContent value="advanced">
          <Card className="flex flex-col gap-4">
            <h2 className="font-semibold">Per-channel transcoding overrides</h2>
            <p className="text-sm text-slate-500">Leave blank to use the global FFmpeg settings.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Target resolution">
                <TextInput
                  placeholder="e.g. 1920x1080"
                  value={channel.transcoding?.targetResolution ?? ''}
                  onChange={(e) =>
                    update('transcoding', { ...channel.transcoding, targetResolution: e.target.value })
                  }
                />
              </Field>
              <Field label="Video bitrate (kb/s)">
                <TextInput
                  type="number"
                  value={channel.transcoding?.videoBitrate ?? ''}
                  onChange={(e) =>
                    update('transcoding', {
                      ...channel.transcoding,
                      videoBitrate: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </Field>
              <Field label="Video buffer size (kb)">
                <TextInput
                  type="number"
                  value={channel.transcoding?.videoBufSize ?? ''}
                  onChange={(e) =>
                    update('transcoding', {
                      ...channel.transcoding,
                      videoBufSize: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </Field>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/channels')}>
          Cancel
        </Button>
        <Button onClick={save} loading={saving}>
          {isNew ? 'Create channel' : 'Save changes'}
        </Button>
      </div>

      {showLibrary && (
        <Dialog open onOpenChange={setShowLibrary} title="Add from Plex library" size="xl">
          <PlexLibraryBrowser
            onAdd={(programs) => {
              setPrograms(channel.programs.concat(programs))
              toast.success(`Added ${programs.length} program${programs.length === 1 ? '' : 's'}.`)
            }}
          />
        </Dialog>
      )}

      {showTimeSlots && (
        <TimeSlotsEditorDialog
          open
          programs={channel.programs}
          initialSchedule={channel.scheduleBackup as TimeSlotSchedule | undefined}
          onCancel={() => setShowTimeSlots(false)}
          onDone={({ programs, schedule }) => {
            setChannel((prev) => (prev ? { ...prev, programs, scheduleBackup: schedule } : prev))
            setShowTimeSlots(false)
          }}
        />
      )}

      {showRandomSlots && (
        <RandomSlotsEditorDialog
          open
          programs={channel.programs}
          initialSchedule={channel.randomScheduleBackup as RandomSlotSchedule | undefined}
          onCancel={() => setShowRandomSlots(false)}
          onDone={({ programs, schedule }) => {
            setChannel((prev) => (prev ? { ...prev, programs, randomScheduleBackup: schedule } : prev))
            setShowRandomSlots(false)
          }}
        />
      )}
    </div>
  )
}

function FillerAndFlexTab({
  channel,
  fillerLists,
  update,
}: {
  channel: Channel
  fillerLists: FillerList[]
  update: <K extends keyof Channel>(key: K, value: Channel[K]) => void
}) {
  const selectedIds = new Set(channel.fillerCollections.map((f) => f.id))

  function toggleFiller(id: string) {
    if (selectedIds.has(id)) {
      update(
        'fillerCollections',
        channel.fillerCollections.filter((f) => f.id !== id),
      )
    } else {
      update('fillerCollections', [...channel.fillerCollections, { id, weight: 1, cooldown: 0 }])
    }
  }

  function updateFillerRef(id: string, patch: Partial<FillerCollectionRef>) {
    update(
      'fillerCollections',
      channel.fillerCollections.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">Filler lists</h2>
        <p className="text-sm text-slate-500">
          Filler content (commercials, bumpers) plays between programs on this channel.
        </p>
        {fillerLists.length === 0 ? (
          <p className="text-sm text-slate-500">No filler lists yet — create one from the Filler screen.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {fillerLists.map((f) => {
              const ref = channel.fillerCollections.find((c) => c.id === f.id)
              return (
                <li key={f.id} className="flex items-center gap-4 py-2">
                  <Switch checked={!!ref} onCheckedChange={() => toggleFiller(f.id)} />
                  <span className="flex-1 text-sm">{f.name}</span>
                  {ref && (
                    <>
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        Weight
                        <TextInput
                          type="number"
                          className="w-16"
                          value={ref.weight}
                          onChange={(e) => updateFillerRef(f.id, { weight: Number(e.target.value) })}
                        />
                      </label>
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        Cooldown (min)
                        <TextInput
                          type="number"
                          className="w-16"
                          value={ref.cooldown / 60000}
                          onChange={(e) => updateFillerRef(f.id, { cooldown: Number(e.target.value) * 60000 })}
                        />
                      </label>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Filler repeat cooldown (minutes)" hint="Minimum gap before repeating any filler item.">
            <TextInput
              type="number"
              value={channel.fillerRepeatCooldown / 60000}
              onChange={(e) => update('fillerRepeatCooldown', Number(e.target.value) * 60000)}
            />
          </Field>
          <Field label="Disable filler overlay watermark">
            <Switch
              checked={channel.disableFillerOverlay}
              onCheckedChange={(v) => update('disableFillerOverlay', v)}
            />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold">Flex &amp; offline</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Offline mode">
            <Select value={channel.offlineMode} onChange={(e) => update('offlineMode', e.target.value as Channel['offlineMode'])}>
              <option value="pic">Picture</option>
              <option value="clip">Clip</option>
            </Select>
          </Field>
          <Field label="Guide flex placeholder" hint="Title shown in the guide during flex/offline time.">
            <TextInput
              value={channel.guideFlexPlaceholder}
              onChange={(e) => update('guideFlexPlaceholder', e.target.value)}
            />
          </Field>
          <Field label="Offline picture URL">
            <TextInput value={channel.offlinePicture} onChange={(e) => update('offlinePicture', e.target.value)} />
          </Field>
          <Field label="Offline soundtrack URL">
            <TextInput
              value={channel.offlineSoundtrack}
              onChange={(e) => update('offlineSoundtrack', e.target.value)}
            />
          </Field>
          <Field label="Guide minimum duration (seconds)">
            <TextInput
              type="number"
              value={channel.guideMinimumDurationSeconds}
              onChange={(e) => update('guideMinimumDurationSeconds', Number(e.target.value))}
            />
          </Field>
        </div>
      </Card>
    </div>
  )
}

function WatermarkTab({
  channel,
  setChannel,
  uploadIconTo,
}: {
  channel: Channel
  setChannel: Dispatch<SetStateAction<Channel | null>>
  uploadIconTo: (field: 'icon' | 'offlinePicture' | 'watermark.url', file: File) => void
}) {
  const watermark = channel.watermark
  function updateWatermark(patch: Partial<NonNullable<Channel['watermark']>>) {
    setChannel((prev) => (prev ? { ...prev, watermark: { ...prev.watermark!, ...patch } } : prev))
  }

  return (
    <Card className="flex flex-col gap-4">
      <Field label="Enable watermark">
        <Switch checked={!!watermark?.enabled} onCheckedChange={(v) => updateWatermark({ enabled: v })} />
      </Field>
      {watermark?.enabled && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Image URL">
            <div className="flex items-center gap-2">
              <TextInput
                className="flex-1"
                value={watermark.url ?? ''}
                onChange={(e) => updateWatermark({ url: e.target.value })}
              />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadIconTo('watermark.url', e.target.files[0])}
                />
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">
                  <Upload className="h-4 w-4" />
                </span>
              </label>
            </div>
          </Field>
          <Field label="Position">
            <Select
              value={watermark.position}
              onChange={(e) => updateWatermark({ position: e.target.value as typeof watermark.position })}
            >
              <option value="top-left">Top left</option>
              <option value="top-right">Top right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
            </Select>
          </Field>
          <Field label="Width (% of video width)">
            <TextInput
              type="number"
              value={watermark.width}
              onChange={(e) => updateWatermark({ width: Number(e.target.value) })}
            />
          </Field>
          <Field label="Horizontal margin (%)">
            <TextInput
              type="number"
              value={watermark.horizontalMargin}
              onChange={(e) => updateWatermark({ horizontalMargin: Number(e.target.value) })}
            />
          </Field>
          <Field label="Vertical margin (%)">
            <TextInput
              type="number"
              value={watermark.verticalMargin}
              onChange={(e) => updateWatermark({ verticalMargin: Number(e.target.value) })}
            />
          </Field>
          <Field label="Duration (seconds)" hint="0 = show for the whole program.">
            <TextInput
              type="number"
              value={watermark.duration}
              onChange={(e) => updateWatermark({ duration: Number(e.target.value) })}
            />
          </Field>
        </div>
      )}
    </Card>
  )
}
