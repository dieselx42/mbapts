import Link from "next/link";
import { LeadFunnelLoader } from "../components/lead-funnel-loader";

export default function HomePage() {
  return (
    <main className="mx-auto w-[min(1400px,96vw)] py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Operations</p>
          <h1 className="text-2xl font-semibold tracking-tight">Lead Funnel Dashboard</h1>
        </div>
        <Link href="/sample" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
          Open sample screenshot route
        </Link>
      </div>
      <LeadFunnelLoader />
    </main>
  );
}
