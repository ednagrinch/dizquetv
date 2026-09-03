import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileCode, FileVideo, Github } from 'lucide-react'
import { useServerEvents } from '../hooks/useServerEvents'

const navItems = [
  { to: '/guide', key: 'topMenu.guide', fallback: 'Guide' },
  { to: '/channels', key: 'topMenu.channels', fallback: 'Channels' },
  { to: '/filler', key: 'topMenu.filler', fallback: 'Filler' },
  { to: '/custom-shows', key: 'topMenu.customShows', fallback: 'Custom Shows' },
  { to: '/library', key: 'topMenu.library', fallback: 'Library' },
  { to: '/player', key: 'topMenu.player', fallback: 'Player' },
  { to: '/settings', key: 'topMenu.settings', fallback: 'Settings' },
  { to: '/version', key: 'topMenu.version', fallback: 'Version' },
]

function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-600 text-white'
      : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800',
  ].join(' ')
}

export default function Layout() {
  const { t } = useTranslation()
  useServerEvents()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <NavLink to="/guide" className="flex items-center gap-2 text-lg font-semibold">
            <img src="/images/dizquetv.png" alt="dizqueTV" className="h-8 w-8" />
            dizqueTV
          </NavLink>

          <nav className="flex flex-wrap gap-1">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {t(item.key, item.fallback)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <a
              className="flex items-center gap-1 hover:text-brand-600"
              href="/api/xmltv.xml"
              title="XMLTV guide export"
            >
              <FileCode className="h-4 w-4" /> XMLTV
            </a>
            <a
              className="flex items-center gap-1 hover:text-brand-600"
              href="/api/channels.m3u"
              title="M3U playlist export"
            >
              <FileVideo className="h-4 w-4" /> M3U
            </a>
            <a
              className="hover:text-brand-600"
              href="https://github.com/vexorian/dizquetv"
              title="Git repository"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
