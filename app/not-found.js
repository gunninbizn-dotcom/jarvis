export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-cyan-100">
      <div className="max-w-xl text-center p-8 rounded-3xl border border-cyan-500/20 bg-black/80 backdrop-blur-xl">
        <h1 className="text-4xl font-bold mb-4">404 — Page not found</h1>
        <p className="text-sm text-cyan-300 mb-6">The page you are looking for does not exist or has been moved.</p>
        <p className="text-xs text-cyan-500">Return to the Jarvis interface via the home page.</p>
      </div>
    </div>
  )
}
