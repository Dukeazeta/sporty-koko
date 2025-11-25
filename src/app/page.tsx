// src/app/page.tsx
import Link from 'next/link';
import { fetchCompetitions } from '@/lib/services/dataService';
import { IconArrowRight, IconTrophy, IconStar, IconFlame } from '@/components/Icons';

import RateLimitUpdater from '@/components/RateLimitUpdater';

export default async function Home() {
  const { competitions, rateLimitInfo } = await fetchCompetitions();

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto bg-[var(--neo-bg)]">
      <RateLimitUpdater rateLimitInfo={rateLimitInfo} />
      {/* Header Section */}
      <header className="mb-12 md:mb-16 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full bg-[var(--neo-yellow)] -rotate-1 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] z-0"></div>
        <div className="relative z-10 py-6 md:py-8 px-4">
          <h1 className="text-4xl sm:text-5xl md:text-8xl font-black uppercase tracking-tighter mb-3 md:mb-4 text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] stroke-black" style={{ WebkitTextStroke: '2px black' }}>
            SportyKoko
          </h1>
          <div className="inline-block bg-[var(--neo-pink)] border-3 md:border-4 border-black p-2 md:p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-2">
            <p className="text-base sm:text-xl md:text-2xl font-bold font-mono text-white uppercase">
              Prediction Engine v2.0
            </p>
          </div>
        </div>
      </header>

      {/* Decorative Elements */}
      <div className="hidden md:block absolute top-20 left-10 animate-bounce">
        <IconStar className="w-12 h-12 text-[var(--neo-purple)]" />
      </div>
      <div className="hidden md:block absolute top-40 right-10 animate-pulse">
        <IconFlame className="w-16 h-16 text-[var(--neo-orange)]" />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 relative z-10">
        {competitions.map((comp, index) => (
          <Link key={comp.id} href={`/competitions/${comp.id}`} className="block group active:scale-95 transition-transform">
            <div className={`neo-box p-6 md:p-8 h-full flex flex-col justify-between bg-white hover:bg-[var(--neo-green)] transition-all ${index % 2 === 0 ? 'rotate-1' : '-rotate-1'} group-hover:rotate-0`}>
              <div className="flex items-start justify-between mb-6">
                <div className="bg-black text-white font-mono text-sm px-2 py-1 border-2 border-transparent group-hover:border-white">
                  {comp.code}
                </div>
                {comp.emblem ? (
                  <img src={comp.emblem} alt={comp.name} className="w-20 h-20 object-contain drop-shadow-[4px_4px_0px_rgba(0,0,0,0.2)]" />
                ) : (
                  <IconTrophy className="w-16 h-16 text-black" />
                )}
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase leading-none mb-2 group-hover:text-white group-hover:drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all">
                  {comp.name}
                </h2>
                <div className="w-full h-1 bg-black my-3 md:my-4"></div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base md:text-lg group-hover:text-white">VIEW MATCHES</span>
                  <IconArrowRight className="w-6 h-6 md:w-8 md:h-8 transform group-hover:translate-x-2 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        ))}

        {competitions.length === 0 && (
          <div className="col-span-full neo-box p-8 md:p-12 text-center bg-gray-100 rotate-1">
            <h3 className="text-2xl md:text-3xl font-black uppercase mb-4">No Competitions Found</h3>
            <p className="font-mono text-base md:text-lg mb-6">The API might be taking a nap.</p>
            <button className="neo-button" onClick={() => window.location.reload()}>
              RETRY CONNECTION
            </button>
          </div>
        )}
      </div>

      <footer className="mt-24 text-center font-mono text-sm border-t-4 border-black pt-8 pb-8 bg-[var(--neo-bg)]">
        <p className="font-bold">SPORTYKOKO © 2025</p>
        <p className="text-xs mt-2">POWERED BY KOKO LABS</p>
      </footer>
    </main>
  );
}
