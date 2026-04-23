import { redirect } from "next/navigation";
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link';

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: clientData } = await supabase
    .from('clients')
    .select('name')
    .eq('email', user.email)
    .single();

  let topNavName = "Client Portal";
  if (clientData?.name) {
    topNavName = `${clientData.name} - Portal`;
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-50 w-full relative">
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/portal" className="font-bold text-xl tracking-tight bg-gradient-to-r from-teal-400 to-indigo-500 bg-clip-text text-transparent">
              {topNavName}
            </Link>
            <nav className="hidden items-center gap-4 md:flex">
              <Link href="/portal" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">
                Dashboard
              </Link>
              <Link href="/portal/approvals" className="text-sm text-zinc-400 transition-colors hover:text-zinc-100">
                Approvals
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">{user.email}</span>
            <form action="/auth/signout" method="POST">
                <button type="submit" className="text-sm px-4 py-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400">
                  Logout
                </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
