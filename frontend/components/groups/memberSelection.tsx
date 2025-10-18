// components/groups/members-selection.tsx
'use client'

import { X, Search } from "lucide-react";
import Avatar from "@/components/ui/avatar";
import { User } from "@/types/user";

interface MembersSelectionProps {
  usersForInvite: User[];
  tempselectedGroupUsers: User[];
  query: string;
  onQueryChange: (query: string) => void;
  onToggleUser: (user: User) => void;
  onBack: () => void;
  onDone: () => void;
  maxMembers?: number;
}

export default function MembersSelection({
  usersForInvite,
  tempselectedGroupUsers,
  query,
  onQueryChange,
  onToggleUser,
  onBack,
  onDone,
  maxMembers = 50
}: MembersSelectionProps) {

  return (
    <div className='p-2'>
      <div className='flex justify-between items-center mb-4'>
        <h3 className='text-white text-lg font-semibold'>Select Members</h3>
        <button
          onClick={onBack}
          className='text-gray-400 hover:text-white p-1'
        >
          <X className='w-5 h-5' />
        </button>
      </div>

      {/* Member count indicator */}
      <div className={cls(
        "text-sm mb-4 p-2 rounded-md text-center",
        tempselectedGroupUsers.length >= maxMembers ? "bg-red-900/30 text-red-300 border border-red-500/50" :
        tempselectedGroupUsers.length > 0 ? "bg-purple-900/30 text-purple-300 border border-purple-500/50" :
        "bg-gray-900/30 text-gray-400 border border-gray-500/50"
      )}>
        {tempselectedGroupUsers.length} / {maxMembers} members selected
        {tempselectedGroupUsers.length >= maxMembers && (
          <div className="text-xs mt-1">Maximum limit reached</div>
        )}
      </div>

      {/* search members */}
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] backdrop-blur-[6px] w-full mb-4">
        <Search className='w-5 h-5 text-[#aab9c2]'/>
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Search members..."
          className="bg-transparent border-0 outline-none text-white w-full placeholder:text-[#aab9c2]"
        />
      </div>

      {/* Users list to select from */}
      <div className='p-2 rounded-md max-h-64 overflow-y-auto'>
        <div className='space-y-2'>
          {usersForInvite.map(user => (
            <button
              key={user.id}
              type='button'
              onClick={() => onToggleUser(user)}
              className={`w-full flex items-center gap-3 p-2 rounded-md transition ${
                tempselectedGroupUsers.some(u => u.id === user.id)
                  ? 'border border-[rgba(255,0,255,.35)] shadow-[0_0_12px_rgba(255,0,255,.25)] text-white'
                  : 'bg-[#292929] text-white hover:bg-[#4a4a4a]'
              }`}
            >
              <Avatar user={user} size={8} color="radial-gradient(circle at 30% 30%, #ff66ff, #ffb3ff), #ff66ff"/>
              <div className='text-left flex-1'>
                <div className='font-medium'>{user.nickname}</div>
                <div className='text-sm opacity-75'>
                  {user.firstName} {user.lastName}
                </div>
              </div>
              {tempselectedGroupUsers.some(u => u.id === user.id) && (
                <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-[rgba(255,0,255,.35)] rounded-full"></div>
                </div> 
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Done btn */}
      <button
        onClick={onDone}
        className="w-full mt-4 bg-[rgba(255,0,255,.35)] text-white py-2 rounded-md hover:bg-[rgba(255,0,255,.50)] transition"
      >
        Done ({tempselectedGroupUsers.length} selected)
      </button>
    </div>
  );
}

const cls = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')
