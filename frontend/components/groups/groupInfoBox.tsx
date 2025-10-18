import { Clock, Crown, LogOut, MailPlus, Plus, Trash2, Users, X } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import InviteMembersModal from './invite-members-modal'
import { toast, ToastContainer } from 'react-toastify';


interface GroupInfo {
  id: string | number
  title: string
  description: string
  member_count: number
  is_member: boolean
  is_creator?: boolean
  has_requested?: boolean
  is_invited?: boolean
}

interface GroupInfoProps {
  group: GroupInfo
  onClose: () => void
onLeaveGroup: (groupId: number | string) => void;
  onDeleteGroup: (groupId: number | string) => void;
}

const GroupInfo: React.FC<GroupInfoProps> = ({ group, onClose, onLeaveGroup, onDeleteGroup }) => {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [joinRequestStatus, setJoinRequestStatus] = useState<'none' | 'pending' | 'invited'>('none')
  const [isMember, setIsMember] = useState<boolean>(group.is_member)
  const [isLoading, setIsLoading] = useState(false)

  const gid = String(group.id)

  useEffect(() => {
    setIsMember(group.is_member)
    checkUserJoinStatus()
  }, [group.id, group.is_member])

  useEffect(() => {
    const onMembership = (e: Event) => {
      const { groupId, status } = (e as CustomEvent).detail || {}
      if (String(groupId) !== gid) return

      switch (status) {
        case 'requested':
          setJoinRequestStatus('pending')
          break
        case 'invited':
          setJoinRequestStatus('invited')
          break
        case 'accepted':
          setJoinRequestStatus('none')
          setIsMember(true)
          break
        case 'declined':
          setJoinRequestStatus('none')
          setIsMember(false)
          break
        case 'left':
        case 'deleted':
          setJoinRequestStatus('none')
          setIsMember(false)
          break
      }
    }

    window.addEventListener('group:membership', onMembership as EventListener)
    return () => window.removeEventListener('group:membership', onMembership as EventListener)
  }, [gid])

  const checkUserJoinStatus = async () => {
    try {
      const res = await fetch(`/api/group/check-join-status?group_id=${gid}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (data.status === 'requested') setJoinRequestStatus('pending')
      else if (data.status === 'invited') setJoinRequestStatus('invited')
      else setJoinRequestStatus('none')
    } catch (err) {
      console.error('Failed to check join status:', err)
    }
  }

  const handleRequestToJoinGroup = async () => {
    setIsLoading(true)
    try {
      const formData = new URLSearchParams()
      formData.append('group_id', gid)

      const res = await fetch('/api/group/request-to-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
        credentials: 'include',
      })

      if (res.ok) {
        setJoinRequestStatus('pending')
         toast.success('Request to join sent successfully!')
      } else {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to send join request')
      }
    } catch (err) {
      console.error('Error requesting to join group:', err)
      toast.error('Failed to send join request')
    } finally {
      setIsLoading(false)
    }
  }

  const userStatus = (() => {
    if (group.is_creator) {
      return {
        text: 'Admin',
        color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        icon: <Crown className="w-4 h-4 -rotate-12 absolute -top-2 left-0 text-[#ffdc7e]" />,
      }
    }
    if (isMember) {
      return {
        text: 'Member',
        color: 'bg-green-500/20 text-green-300 border-green-500/30',
        icon: null,
      }
    }
    if (joinRequestStatus === 'pending') {
      return {
        text: 'Request Pending',
        color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
        icon: null,
      }
    }
    if (joinRequestStatus === 'invited') {
      return {
        text: "You're Invited",
        color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        icon: <MailPlus className="w-4 h-4 absolute -top-2 left-0" />,
      }
    }
    return {
      text: 'Not a member',
      color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
      icon: null,
    }
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border bg-[#1b1b1b] border-[rgba(255,0,255,.35)] shadow-[0_0_12px_rgba(255,0,255,.25)]">
        {/* Status tag */}
        <div className="relative top-[19px] left-4">
          {userStatus.icon}
          <span className={`absolute text-xs px-2 py-1 rounded-full border ${userStatus.color}`}>{userStatus.text}</span>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:text-[rgba(255,0,255,.75)] transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="p-6 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center justify-center mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-black"
              style={{ background: 'radial-gradient(circle at 30% 30%, #ff66ff, #ffb3ff), #ff66ff' }}
            >
              {group.title.charAt(0).toUpperCase()}
            </div>
          </div>

          <h2 className="text-xl font-bold text-center text-white mb-2 break-words px-2">{group.title}</h2>
          <p className="text-[#aab] text-center text-sm break-words px-2">{group.description || 'No description provided'}</p>
        </div>

        {/* Stats */}
        <div className="p-6 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-[#9aa]">
              <Users className="w-5 h-5 mr-2" />
              <span>Members</span>
            </div>
            <span className="text-white">{group.member_count}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 space-y-3">
          {isMember ? (
            <>
              {group.is_creator ? (
                // Creator: can invite & delete
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="w-full flex items-center justify-center py-2 rounded-xl hover:bg-black/50 border border-[#ff66ff]/30 text-white hover:text-[#ff66ff]/80 transition-colors"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Invite Members
                  </button>

                  <button
                    onClick={() => onDeleteGroup(gid)}
                    className="w-full flex items-center justify-center py-2 rounded-xl hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Delete Group
                  </button>
                </div>
              ) : (
                // Member: can invite & leave
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="w-full flex items-center justify-center py-2 rounded-xl hover:bg-black/50 border border-[#ff66ff]/30 text-white hover:text-[#ff66ff]/80 transition-colors"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Invite Members
                  </button>

                  <button
                    onClick={() => onLeaveGroup(gid)}
                    className="w-full flex items-center justify-center py-2 rounded-xl hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <LogOut className="w-5 h-5 mr-2" />
                    Leave Group
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={handleRequestToJoinGroup}
              disabled={joinRequestStatus !== 'none' || isLoading}
              className={`w-full flex items-center justify-center py-2 rounded-xl border transition-colors ${
                joinRequestStatus !== 'none' || isLoading
                  ? 'bg-gray-600/30 border-gray-500/30 text-gray-400 cursor-not-allowed'
                  : 'hover:bg-green-600/30 border-green-500/30 text-white hover:text-green-300'
              }`}
            >
              {isLoading ? (
                <>Loading...</>
              ) : joinRequestStatus === 'pending' ? (
                <>
                  <Clock className="w-5 h-5 mr-2" />
                  Request Pending
                </>
              ) : joinRequestStatus === 'invited' ? (
                <>
                  <MailPlus className="w-5 h-5 mr-2" />
                  You&apos;re Invited
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 mr-2" />
                  Join Group
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <InviteMembersModal
        groupId={gid}                 
        groupTitle={group.title}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInviteSuccess={() => setShowInviteModal(false)}
      />
    </div>
  )
}

export default GroupInfo
