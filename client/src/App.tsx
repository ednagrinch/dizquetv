import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import SettingsPage from './pages/Settings'
import VersionPage from './pages/Version'
import PlayerPage from './pages/Player'
import FillerPage from './pages/Filler'
import CustomShowsPage from './pages/CustomShows'
import ChannelsPage from './pages/Channels'
import ChannelEditor from './pages/Channels/ChannelEditor'
import LibraryPage from './pages/Library'
import GuidePage from './pages/Guide'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/guide" replace />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/channels/:number" element={<ChannelEditor />} />
          <Route path="/filler" element={<FillerPage />} />
          <Route path="/custom-shows" element={<CustomShowsPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/version" element={<VersionPage />} />
          <Route path="*" element={<Navigate to="/guide" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
