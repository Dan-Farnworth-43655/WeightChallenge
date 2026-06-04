import { useEffect } from 'react'
import confetti from 'canvas-confetti'

// Celebration modal shown when the active user earns one or more new badges.
// If multiple are unlocked at once, they're shown one at a time — tapping
// continue advances the queue.
export default function BadgeUnlockToast({ badge, participant, queueLength, onClose }) {
  useEffect(() => {
    // Confetti burst when the modal mounts
    const colors = [participant.color, '#fbbf24', '#f472b6', '#34d399', '#ffffff']
    confetti({ particleCount: 100, angle: 60,  spread: 70, origin: { x: 0,   y: 0.7 }, colors })
    confetti({ particleCount: 100, angle: 120, spread: 70, origin: { x: 1,   y: 0.7 }, colors })
    confetti({ particleCount: 60,  angle: 90,  spread: 80, origin: { x: 0.5, y: 0.4 }, colors })
  }, [badge.id])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 rounded-3xl p-6 mx-4 max-w-xs w-full text-center shadow-2xl"
        style={{ borderColor: participant.color + 'AA' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs uppercase tracking-[0.25em] text-amber-300 font-bold mb-2">Badge Unlocked!</p>
        <div className="text-7xl mb-3 animate-bounce inline-block">{badge.emoji}</div>
        <h2 className="text-2xl font-black tracking-tight mb-1" style={{ color: participant.color }}>
          {badge.name}
        </h2>
        <p className="text-slate-400 text-sm mb-5">{badge.description}</p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-black text-base transition-colors active:scale-95"
          style={{ backgroundColor: participant.color, color: '#000' }}
        >
          {queueLength > 1 ? `Next (${queueLength - 1} more)` : 'Nice! 🔥'}
        </button>
      </div>
    </div>
  )
}
