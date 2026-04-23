'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createClientAction } from '@/app/(admin)/clients/actions';

type AvailableShow = {
  id: string;
  title: string;
};

export function CreateClientForm({ availableShows }: { availableShows: AvailableShow[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
        const result = await createClientAction(formData);
        if (result?.error) {
            setError(result.error);
        } else {
            setSuccess(`Client provisioned! Tell them to log in using password: ${result.tempPassword}`);
            router.refresh();
        }
    } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
        setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-500 rounded-md text-sm">{error}</div>}
      {success && <div className="p-3 bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 rounded-md text-sm">{success}</div>}

      <div className="space-y-2">
        <Label htmlFor="name">Client Company / Name</Label>
        <Input id="name" name="name" required placeholder="e.g. John Doe LLC" className="bg-white/5 border-white/10" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Login Email</Label>
        <Input id="email" name="email" type="email" required placeholder="client@example.com" className="bg-white/5 border-white/10" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="show">Target Captivate Show</Label>
        <select 
          name="show_id"
          defaultValue=""
          required
          className="flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled hidden className="bg-zinc-950 text-zinc-400">Select an active show to link...</option>
          {availableShows.map((s) => (
            <option key={s.id} value={s.id} className="bg-zinc-950 text-white">{s.title}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="zernio_profile_id">Zernio Profile ID</Label>
        <Input id="zernio_profile_id" name="zernio_profile_id" required placeholder="Paste the Zernio profile ID" className="bg-white/5 border-white/10 font-mono text-sm" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="zernio_id">Default Publish Account ID</Label>
        <Input id="zernio_id" name="zernio_account_id" required placeholder="Paste the default YouTube/Zernio account ID" className="bg-white/5 border-white/10 font-mono text-sm" />
      </div>

      <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
        {loading ? "Provisioning..." : "Provision Client Account"}
      </Button>
    </form>
  );
}
