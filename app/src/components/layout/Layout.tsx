import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          data-tauri-drag-region
          className="flex h-10 shrink-0 items-center border-b border-[hsl(var(--border))] px-4"
        >
          <div data-tauri-drag-region className="flex-1" />
        </div>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
