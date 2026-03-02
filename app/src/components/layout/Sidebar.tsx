import { NavLink } from 'react-router-dom';
import { Wand2, Images, Box, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServerStore } from '@/stores/serverStore';

const navItems = [
  { to: '/', label: 'Studio', icon: Wand2 },
  { to: '/gallery', label: 'Gallery', icon: Images },
  { to: '/models', label: 'Models', icon: Box },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const backendStatus = useServerStore((s) => s.backendStatus);

  const statusColor =
    backendStatus === 'healthy'
      ? 'bg-green-500'
      : backendStatus === 'starting'
        ? 'bg-yellow-500'
        : 'bg-red-500';

  const statusLabel =
    backendStatus === 'healthy'
      ? 'Connected'
      : backendStatus === 'starting'
        ? 'Starting'
        : 'Disconnected';

  return (
    <aside className="flex w-56 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div
        data-tauri-drag-region
        className="flex h-10 items-center px-4 text-lg font-bold tracking-tight"
      >
        Forge
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Backend status indicator */}
      <div className="border-t border-[hsl(var(--border))] px-3 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn('h-2 w-2 shrink-0 rounded-full', statusColor)}
          />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            Backend: {statusLabel}
          </span>
        </div>
      </div>
    </aside>
  );
}
