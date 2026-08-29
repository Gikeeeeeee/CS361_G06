function App() {
  const folders = [
    { name: 'components', desc: 'Reusable UI elements' },
    { name: 'hooks', desc: 'Custom React hooks' },
    { name: 'pages', desc: 'App views and routes' },
    { name: 'services', desc: 'API client integration' },
    { name: 'context', desc: 'React Context providers' },
    { name: 'types', desc: 'TypeScript type definitions' },
    { name: 'utils', desc: 'Helper and utility functions' },
  ]

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between font-sans selection:bg-purple-500 selection:text-white">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 py-20 relative z-10">
        <div className="max-w-3xl w-full text-center">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Clean Sandbox Ready
          </div>

          {/* Heading */}
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 mb-4">
            CS361 Project Template
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-xl mx-auto mb-12">
            The boilerplate has been cleaned and is ready for development. Tailwind CSS v4 is integrated and active.
          </p>

          {/* Directories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-left">
            {folders.map((folder) => (
              <div
                key={folder.name}
                className="group p-5 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-purple-500/50 hover:bg-neutral-900 transition-all duration-300"
              >
                <div className="flex items-center gap-2 text-neutral-200 font-mono text-sm font-semibold mb-1 group-hover:text-purple-400 transition-colors">
                  <span className="text-purple-500">/</span>
                  {folder.name}
                </div>
                <p className="text-neutral-500 text-xs leading-relaxed">
                  {folder.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-neutral-600 text-xs border-t border-neutral-900 relative z-10">
        &copy; {new Date().getFullYear()} CS361_G06. All rights reserved.
      </footer>
    </div>
  )
}

export default App
