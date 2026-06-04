// Tap-to-view modal — shows the full description and who's earned a badge.
// Works for both locked and unlocked badges so locked criteria are discoverable.
export default function BadgeDetailsModal({ badge, earners = [], onClose }) {
  const isLocked = earners.length === 0
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`bg-slate-900 border-2 rounded-3xl p-6 mx-4 max-w-xs w-full text-center shadow-2xl ${
          isLocked ? 'border-slate-700' : 'border-amber-400/60'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`text-7xl mb-3 ${isLocked ? 'grayscale opacity-60' : ''}`}>{badge.emoji}</div>
        <h2 className="text-xl font-black tracking-tight mb-1 text-white">{badge.name}</h2>
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">
          {isLocked ? '🔒 Locked' : `Earned by ${earners.length}`}
        </p>
        <p className="text-slate-300 text-sm mb-5">{badge.description}</p>

        {/* Earners */}
        {earners.length > 0 && (
          <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
            {earners.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 bg-slate-800 rounded-full px-2 py-1">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                  style={{ backgroundColor: p.color, color: '#000' }}
                >
                  {p.initials[0]}
                </span>
                <span className="text-xs text-slate-200 font-semibold pr-1">{p.name}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-200"
        >
          Close
        </button>
      </div>
    </div>
  )
}
