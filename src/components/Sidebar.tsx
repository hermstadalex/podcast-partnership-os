'use client';

import Link from 'next/link';
import { Mic, LayoutDashboard, Users, Settings } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { RealtimeAvatarStack } from '@/components/realtime-avatar-stack';

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Command Center', href: '/', icon: LayoutDashboard },
    { name: 'Shows', href: '/shows', icon: Mic },
    { name: 'Team', href: '/team', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="w-64 border-r border-zinc-800 bg-zinc-950/50 backdrop-blur-xl flex flex-col justify-between hidden md:flex">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center">
            <Mic className="h-5 w-5 text-zinc-950" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-zinc-100">Partnership OS</span>
        </div>
        
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-zinc-800 text-zinc-100' 
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-6 border-t border-zinc-800">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Online Now
          </div>
        </div>
        
        {/* Supabase UI Realtime Avatar Stack */}
        <RealtimeAvatarStack roomName="dashboard_online" />
      </div>
    </div>
  );
}
