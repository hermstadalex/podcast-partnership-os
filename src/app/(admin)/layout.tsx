import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen w-full flex-col md:flex-row overflow-hidden bg-zinc-950">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileNav />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
