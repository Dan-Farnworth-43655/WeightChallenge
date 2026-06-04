// Shown after a log when the user is on the cusp of unlocking another badge.
// Smaller / less intense than the unlock toast — it's a nudge, not a celebration.
export default function AlmostThereModal({ badge, message, participant, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-sky-500/60 rounded-3xl p-6 mx-4 max-w-xs w-full text-center shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs uppercase tracking-[0.25em] text-sky-300 font-bold mb-2">Almost There</p>
        <div className="text-6xl mb-3">{badge.emoji}</div>
        <h2 className="text-xl font-black tracking-tight mb-1 text-white">{badge.name}</h2>
        <p className="text-slate-400 text-xs mb-3">{badge.description}</p>
        <p className="text-base font-bold mb-5" style={{ color: participant?.color ?? '#0ea5e9' }}>
          {message}
        </p>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl font-bold text-sm bg-sky-500 hover:bg-sky-400 text-white transition-colors active:scale-95"
        >
          Let's go 🔥
        </button>
      </div>
    </div>
  )
}
