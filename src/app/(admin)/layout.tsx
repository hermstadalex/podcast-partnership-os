import { Sidebar } from "@/components/Sidebar";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </>
  );
}
