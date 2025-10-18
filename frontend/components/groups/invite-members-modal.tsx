// components/groups/invite-members-modal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import MembersSelection from './memberSelection';
import { User } from '@/types/user';
import { toast, ToastContainer } from 'react-toastify';

interface InviteMembersModalProps {
  groupId: string;
  groupTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess: () => void;
}

const InviteMembersModal: React.FC<InviteMembersModalProps> = ({
  groupId,
  groupTitle,
  isOpen,
  onClose,
  onInviteSuccess
}) => {
  const [usersForInvite, setUsersForInvite] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [tempSelectedUsers, setTempSelectedUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchUsersForInvite();
    }
  }, [isOpen, groupId]);

  const fetchUsersForInvite = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/group/invite-users-list?group_id=${groupId}`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.users)) {
          setUsersForInvite(data.users);
        } else {
          setUsersForInvite([]);
        }
      } else {
        setUsersForInvite([]);
      }
    } catch (error) {
      console.error('Failed to fetch users for invite:', error);
      setUsersForInvite([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUsers = async () => {
    if (tempSelectedUsers.length === 0) return;
    
    setSubmitting(true);
    try {
      const formData = new URLSearchParams();
      formData.append('group_id', groupId.toString());
      formData.append('members', JSON.stringify(tempSelectedUsers.map(u => u.id)));
      
      const res = await fetch('/api/group/invite-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        credentials: 'include'
      });

      if (res.ok) {
        toast.success('Users invited successfully!');
        onInviteSuccess();
        handleClose();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to invite users');
      }
    } catch (error) {
      console.error('Failed to invite users:', error);
      toast.error('Failed to invite users');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setTempSelectedUsers([]);
    setQuery('');
    onClose();
  };

  const filteredUsersForInvite = useMemo(() => {
  const q = query.trim().toLowerCase();
  if (!q) return usersForInvite;
  return usersForInvite.filter(u =>
    (u.nickname || "").toLowerCase().includes(q) ||
    u.firstName.toLowerCase().includes(q) ||
    u.lastName.toLowerCase().includes(q) || 
    (u.firstName.toLowerCase() + " " + u.lastName.toLowerCase()).includes(q)
  );
}, [usersForInvite, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border bg-[#1b1b1b] border-[rgba(255,0,255,.35)] shadow-[0_0_12px_rgba(255,0,255,.25)] ">

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="text-center py-8 text-[#9aa]">Loading users...</div>
          ) : (
            <MembersSelection
              usersForInvite={filteredUsersForInvite}
              tempselectedGroupUsers={tempSelectedUsers}
              query={query}
              onQueryChange={setQuery}
              onToggleUser={(user) => {
                if (tempSelectedUsers.some(u => u.id === user.id)) {
                  setTempSelectedUsers(prev => prev.filter(u => u.id !== user.id));
                } else {
                  setTempSelectedUsers(prev => [...prev, user]);
                }
              }}
              onBack={handleClose}
              onDone={() => {
                setSelectedUsers(tempSelectedUsers);
                handleInviteUsers();
              }}
            />
          )}
        </div>
      </div>
         {/* <ToastContainer
        position="bottom-left"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      /> */}
    </div>
  );
};

export default InviteMembersModal;