import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui'
import PlexSettingsTab from './PlexSettingsTab'
import FfmpegSettingsTab from './FfmpegSettingsTab'
import XmltvSettingsTab from './XmltvSettingsTab'
import HdhrSettingsTab from './HdhrSettingsTab'

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" />
      <Tabs defaultValue="plex">
        <TabsList>
          <TabsTrigger value="plex">Plex</TabsTrigger>
          <TabsTrigger value="ffmpeg">FFmpeg</TabsTrigger>
          <TabsTrigger value="xmltv">XMLTV</TabsTrigger>
          <TabsTrigger value="hdhr">HDHomeRun</TabsTrigger>
        </TabsList>
        <TabsContent value="plex">
          <PlexSettingsTab />
        </TabsContent>
        <TabsContent value="ffmpeg">
          <FfmpegSettingsTab />
        </TabsContent>
        <TabsContent value="xmltv">
          <XmltvSettingsTab />
        </TabsContent>
        <TabsContent value="hdhr">
          <HdhrSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
