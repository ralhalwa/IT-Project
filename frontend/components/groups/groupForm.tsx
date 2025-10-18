'use client'

import { GroupFormType, User } from "@/types/user";
import  Avatar from "@/components/ui/avatar";
import { MousePointerClick } from "lucide-react";

interface CreateGroupFormProps {
  groupForm: GroupFormType;
  selectedGroupUsers: User[];
  validationErrors: {
    title?: string;
    description?: string;
    members?: string;
  };
  loading: boolean;
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDescriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSelectMembers: () => void;
  onSubmit: (e: React.FormEvent) => void;
  maxTitleLength?: number;
  maxDescriptionLength?: number;
  maxMembers?: number;
}

export default function GroupForm({
  groupForm,
  selectedGroupUsers,
  validationErrors,
  loading,
  onTitleChange,
  onDescriptionChange,
  onSelectMembers,
  onSubmit,
  maxTitleLength = 20,
  maxDescriptionLength = 200,
  maxMembers = 50
}: CreateGroupFormProps){

const cls = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');

 const handleTitleChangeWithLimit = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.length <= maxTitleLength) {
      onTitleChange(e);
    }
  };

  const handleDescriptionChangeWithLimit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= maxDescriptionLength) {
      onDescriptionChange(e);
    }
  };

  return (
    <div className='p-2 flex flex-col mt-7'>
      <div className='flex items-center mb-5'>
        <h3 className='text-white text-lg font-semibold'>Create New Group</h3>
      </div>

      <form onSubmit={onSubmit} className='space-y-4 flex flex-col'>
        <div className='flex flex-col'>
          <div className="relative">
          <label className="text-sm text-gray-300 mb-2 block"></label>
          <input
            type="text"
            name="groupTitle"
            value={groupForm.title}
            onChange={handleTitleChangeWithLimit}
            placeholder="Enter group title"
            required
            className={cls(
              "w-full p-2 rounded-md bg-[#2a2a2a] border border-[rgba(255,0,255,.35)] shadow-[0_0_8px_rgba(255,0,255,.25)] text-white",
              validationErrors.title
                ? "border-red-500"
                : "border-[#444]"
            )}
          />

          {/* Character counter */}
            <div className={cls(
              "absolute bottom-1 right-2 text-xs pointer-events-none",
              groupForm.title.length > maxTitleLength ? "text-red-400" :
              groupForm.title.length > maxTitleLength * 0.8 ? "text-yellow-400" : "text-[#8aa]"
            )}>
              {groupForm.title.length}/{maxTitleLength}
            </div>
            </div>

          {validationErrors.title && (
            <div className="text-red-400 text-xs mb-3">{validationErrors.title}</div>
          )}
        </div>

        <div className='flex flex-col'>
          <div className="relative">
          <label className="text-sm text-gray-300 mb-2 block"></label>
          <textarea
            value={groupForm.description}
            onChange={handleDescriptionChangeWithLimit}
            name="groupDescription"
            placeholder="Enter group description"
            rows={3}
            required
            className={cls(
              "w-full flex-1 text-white rounded-md px-3 py-2 resize-none bg-[#2a2a2a] border border-[rgba(255,0,255,.35)] shadow-[0_0_8px_rgba(255,0,255,.25)]",
              validationErrors.description
                ? "border-red-500"
                : "border-[#444]"
            )}
          />
            {/* Character counter */}
            <div className={cls(
              "absolute bottom-2 right-2 text-xs pointer-events-none",
              groupForm.description.length > maxDescriptionLength ? "text-red-400" :
              groupForm.description.length > maxDescriptionLength * 0.8 ? "text-yellow-400" : "text-[#8aa]"
            )}>
              {groupForm.description.length}/{maxDescriptionLength}
            </div>
          </div>

          {validationErrors.description && (
            <div className='text-red-400 text-xs mt-1'>{validationErrors.description}</div>
          )}
        </div>

        {/* Selected members preview */}
        <div className='flex items-center gap-2'>
          <label className="text-sm text-gray-300 mb-2 block"></label>
          
          <div className='w-full'>
            <button
              type='button'
              onClick={onSelectMembers}
              className='w-full p-1 rounded-lg border border-[rgba(255,0,255,.35)] text-shadow:0_0_8px_rgba(255,0,255,.25) text-sm text-white hover:text-[rgba(255,0,255,.70)] transition'
            >
              {selectedGroupUsers.length > 0 ? (
                <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <span className="text-[#ff66ff]">{selectedGroupUsers.length} members selected</span>
                  <div className="flex -space-x-2">
                    {selectedGroupUsers.slice(0, 3).map(user => (
                      <Avatar key={user.id} user={user} size={6} color="radial-gradient(circle at 30% 30%, #ff66ff, #ffb3ff), #ff66ff"/>
                    ))}
                    {selectedGroupUsers.length > 3 && (
                      <div className='w-6 h-6 rounded-full bg-[#3a3a3a] border-2 border-[#2a2a2a] flex items-center justify-center text-xs'>
                        +{selectedGroupUsers.length - 3}
                      </div>
                    )}
                  </div>
                  </div>
                <div className={cls(
                    "text-xs",
                    selectedGroupUsers.length > maxMembers ? "text-red-400" :
                    selectedGroupUsers.length > maxMembers * 0.8 ? "text-yellow-400" : "text-[#8aa]"
                  )}>
                    {selectedGroupUsers.length}/{maxMembers}
                  </div>
                </div>
              ) : (
                <div className='flex justify-between items-center'>
                  <div className='flex gap-2'>
                    <span className={validationErrors.members ? "text-red-400" : "text-gray-400 hover:text-[rgba(255,0,255,.70)]"}>
                      {validationErrors.members || "Select members to invite"}
                    </span>
                    <MousePointerClick className='w-5 h-5'/>
                  </div>
                  <div className="text-xs text-[#8aa] mr-1">
                    0/{maxMembers}
                  </div>
                </div>
              )}
            </button>
          </div>

          {validationErrors.members && (
            <div className="text-red-400 text-xs mt-1">{validationErrors.members}</div>
          )}
        </div>

        {/* Create group btn */}
        <div className='flex justify-end'>
          <button
            type="submit"
            disabled={loading || !groupForm.title || !groupForm.description || groupForm.members.length === 0 || groupForm.title.length > maxTitleLength || groupForm.description.length > maxDescriptionLength || selectedGroupUsers.length > maxMembers}
            className="w-20 text-xs bg-[rgba(255,0,255,.35)] text-white py-2 rounded-md font-semibold transition hover:bg-[rgba(255,0,255,.50)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}