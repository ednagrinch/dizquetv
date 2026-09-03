import PlexLibraryBrowser from '../components/PlexLibraryBrowser'
import { PageHeader } from '../components/ui'

export default function LibraryPage() {
  return (
    <div>
      <PageHeader title="Library" description="Browse your Plex libraries." />
      <PlexLibraryBrowser />
    </div>
  )
}
