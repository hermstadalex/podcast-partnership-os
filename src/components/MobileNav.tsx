'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mic, LayoutDashboard, Users, Settings, Bot, Menu, AlertTriangle } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navItems = [
    { name: 'Command Center', href: '/', icon: LayoutDashboard },
    { name: 'Error Center', href: '/errors', icon: AlertTriangle },
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'Shows', href: '/shows', icon: Mic },
    { name: 'Taskbots', href: '/taskbots/episode-art', icon: Bot },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="flex md:hidden items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center">
          <Mic className="h-5 w-5 text-zinc-950" />
        </div>
        <span className="font-semibold text-lg tracking-tight text-zinc-100">Partnership OS</span>
      </div>
      
      <Drawer direction="left" open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </DrawerTrigger>
        <DrawerContent className="bg-zinc-950 border-r border-zinc-800 rounded-none rounded-r-2xl outline-none mt-0">
          <div className="h-full w-full p-6 flex flex-col">
            <DrawerTitle className="sr-only">Navigation Menu</DrawerTitle>
            <div className="flex items-center gap-2 mb-8">
              <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                <Mic className="h-5 w-5 text-zinc-950" />
              </div>
              <span className="font-semibold text-lg tracking-tight text-zinc-100">Partnership OS</span>
            </div>
            
            <nav className="space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-md transition-colors ${
                      isActive 
                        ? 'bg-zinc-800 text-zinc-100' 
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-base font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
