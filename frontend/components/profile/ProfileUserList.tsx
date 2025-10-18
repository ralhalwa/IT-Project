import React from 'react';
import { X } from 'lucide-react';
import CircleAvatar from '@/components/ui/CircleAvatar';
interface User {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string;
}

interface UserListProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    users: User[];
    loading: boolean;
    currentUserId?: string | null;
}


export default function UserList({
    isOpen,
    onClose,
    title,
    users,
    loading,
    currentUserId
}: UserListProps) {

    if (!isOpen) return null;

    return (
        <div className='fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
            <div className='bg-black border border-[#8dffe866] rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden'>
                {/*Header*/}
                <div className='flex items-center justify-between p-4 border-b border-[#8dffe866]'>
                    <h2 className='text-xl font-bold text-white'>{title}</h2>
                    <button
                        onClick={onClose}
                        className='p-2 hover:bg-white/10 rounded-full transition-colors'
                    >
                        <X className="h-5 w-5 text-white" />
                    </button>
                </div>

                {/*Content*/}
                <div className='overflow-y-auto max-h-[60vh]'>
                    {loading ? (
                        <div className="p-8 text-center">
                            {/* <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div> */}
                            <p className="text-white/60 mt-2">Loading...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-white/60">No {title.toLowerCase()} found</p>
                        </div>
                    ) : (
                        <div className='p-2'>
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    className='flex items-center gap-3 p-3 rounded-lg transition-colors'
                                    onClick={() => {
                                        // Navigate to user profile
                                        window.location.href = `/profile/${user.id}`;
                                    }}
                                >
                                    <CircleAvatar
                                        src={user.avatar ? (user.avatar.startsWith('/') ? user.avatar : `/avatars/${user.avatar}`) : ''} // empty string => fallback
                                        title={user.firstName || `${user.firstName ?? ''} ${user.lastName ?? ''}` || user.id}
                                        size={40}
                                        className="border border-[rgba(255,255,255,0.08)] shadow-[0_0_10px_rgba(0,255,255,.25)]"
                                    />
                                    <div className='flex-1'>
                                        <p className='text-white font-medium'>
                                            {user.firstName} {user.lastName}
                                        </p>
                                    </div>
                                    {/* {currentUserId !== user.id && (
                                <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                                    View
                                </button>
                            )} */}
                                    <button className="text-[#8dffe8c5] hover:text-[#67ffe1] text-sm font-medium">
                                        View
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>

    )

}