'use client'

import { Msg, User } from '@/types/user'
import Avatar from '../ui/avatar'

interface MessagesListProps {
  messages: Msg[]
  users: User[]
  meId: string
  isGroup: boolean
  onUserClick?: (userId: string) => void
  onNewUser?: Promise<void>
  fetchMsgs?: Promise<void>
}

export default function MessagesList({ messages, users, meId, isGroup, onUserClick, onNewUser }: MessagesListProps) {
  const dayLabelFor = (d: Date) => {
    const today = new Date()
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

    if (isSameDay(d, today)) return 'Today'
    if (isSameDay(d, yesterday)) return 'Yesterday'
    return d.toLocaleDateString()
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const chunks: JSX.Element[] = []
  let lastDayKey = ''
  let lastSenderId: string | null = null
  const findUser = (id: string) => users.find(u => String(u.id) === String(id));

  for (let index = 0; index < messages.length; index++) {
    const m = messages[index]
    const day = dayLabelFor(new Date(m.ts))
    if (day !== lastDayKey) {
      chunks.push(
        <div key={`sep-${day}-${index}`} className="flex items-center justify-center my-2">
          <span className="text-[11px] px-2 py-[2px] rounded-full border border-[rgba(255,255,255,.12)] text-[#cfe] bg-[#1b1b1b]">
            {day}
          </span>
        </div>
      )
      lastDayKey = day
    }

    const mine = m.from === meId
    const showSender = isGroup && (index === 0 || messages[index - 1].from !== m.from) && !mine

    const u = findUser(m.from);

    const sender = {
      id: m.from,
      firstName: u?.firstName || '',
      lastName: u?.lastName || '',
      nickname: u?.nickname || '',
      avatar: u?.avatar || '',
      name:
        u?.name ||
        [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
        (m as any).nickname ||
        `${(m as any).firstName || ""} ${(m as any).lastName || ""}`.trim() ||
        `${m.from}`,
    }

    const isConsecutiveFromSameSender = isGroup && !mine && m.from === lastSenderId && !showSender
    lastSenderId = m.from


    chunks.push(
      <div
        key={m.id}
        className={`flex ${mine ? 'justify-end' : 'justify-start'} ${showSender ? 'mt-4' : 'mt-1'}`}
      >
        {!mine && (
          <div className={cls(
            "mr-2 flex-shrink-0 mb-1",
            isConsecutiveFromSameSender ? "invisible" : "visible",
          )}>
            {sender && (
              <Avatar
                user={sender}
                size={30}
                color="radial-gradient(circle at 30% 30%, #ff66ff, #ffb3ff), #ff66ff"
              />
            )}
          </div>
        )}

        <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-[78%]`}>
          {/* Sender name for group chats */}
          {showSender && !mine && sender && (
            <button
              onClick={() => onUserClick && onUserClick(sender.id)}
              className='text-xs text-[#8aa] mb-1 font-medium px-2 hover:text-[#aaccff] transition-colors cursor-pointer'
            >
              {sender.nickname || `${sender.firstName + " " + sender.lastName}` || 'unknown'}            </button>
          )}

          {/* Message bubble */}
          <div className={`
            rounded-[14px] px-3.5 py-2.5 border text-[0.95rem] leading-[1.35]
            ${mine
              ? "bg-[#1e2a2a] border-[rgba(0,255,255,.35)] shadow-[0_0_14px_rgba(0,255,255,.18)]"
              : "bg-[#1f1b21] border-[rgba(255,0,255,.28)] shadow-[0_0_14px_rgba(255,0,255,.16)]"
            }`}
            style={{
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}
          >
            <div className="whitespace-pre-wrap break-words overflow-hidden" style={{ lineHeight: '1.4' }}>
              {m.text}
            </div>
            <div className="mt-1.5 text-[11px] opacity-75 flex items-center gap-1">
              {formatTime(m.ts)}
              {mine && m.seen && <span title="Seen">✓✓</span>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{chunks}</>
}

function cls(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}