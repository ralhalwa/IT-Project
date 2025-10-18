'use client'

import { Bell, Plus, UsersRound } from "lucide-react";

interface GroupsHeaderProps {
  groupsViewMode: 'browse' | 'panel' | 'create';
  onViewModeChange: (mode: 'browse' | 'panel' | 'create') => void;
  onCreateGroup: () => void;
}



export default function GroupHeader({
  groupsViewMode,
  onViewModeChange,
  onCreateGroup
 }: GroupsHeaderProps){

    return(
           <div className='flex justify-between gap-3 p-3 border-b border-[rgba(255,255,255,.08)] sticky top-0 bg-[#151515] z-10'>
      <button
        title="browse groups"
        onClick={() => onViewModeChange('browse')}
        className={`p-2 rounded-md transition ${
          groupsViewMode === 'browse' 
            ? "bg-[#2a2a2a] border border-[rgba(255,0,255,.35)] shadow-[0_0_8px_rgba(255,0,255,.25)]"
            : "hover:bg-[#2a2a2a]"
        }`}
      >
        <UsersRound className='w-5 h-5 text-white'/>
      </button>
      
      <button
        title="group panel"
        onClick={() => onViewModeChange('panel')}
        className={`p-2 rounded-md transition ${
          groupsViewMode === 'panel'
            ? "bg-[#2a2a2a] border border-[rgba(255,0,255,.35)] shadow-[0_0_8px_rgba(255,0,255,.25)]"
            : "hover:bg-[#2a2a2a]"
        }`}
      >
        <Bell className='w-5 h-5 text-white'/>
      </button>
      
      <button
        title="create group"
        onClick={onCreateGroup}
        className={`p-2 rounded-md transition ${
          groupsViewMode === 'create'
            ? "bg-[#2a2a2a] border border-[rgba(255,0,255,.35)] shadow-[0_0_8px_rgba(255,0,255,.25)]"
            : "hover:bg-[#2a2a2a]"
        }`}
      >
        <Plus className='w-5 h-5 text-white'/>
      </button>
    </div>
    )
}