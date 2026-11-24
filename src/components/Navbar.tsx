interface NavbarProps {
  tourOpen: boolean;
  onToggleTour: () => void;
  onSelectConceptTab: (tab: 'challenge' | 'physics') => void;
}

export function Navbar({ tourOpen, onToggleTour, onSelectConceptTab }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#F8FAFC]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        <a
          href="#top"
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded"
        >
          PendulumLab
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          <a
            href="#simulator"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Simulator
          </a>
          <a
            href="#how-it-works"
            onClick={() => onSelectConceptTab('challenge')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            How It Works
          </a>
          <a
            href="#how-it-works"
            onClick={() => onSelectConceptTab('physics')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Physics &amp; Math
          </a>
          <a
            href="#experiments"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Experiments
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onToggleTour}
            aria-expanded={tourOpen}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
              tourOpen
                ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {tourOpen ? 'Hide Guide' : 'Guided Tour'}
          </button>
        </div>
      </div>
    </header>
  );
}
