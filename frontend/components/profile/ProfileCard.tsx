import React, {useState, useEffect} from "react";
import { Pencil, LockKeyhole, ChevronRight } from "lucide-react";
import Link from 'next/link';
import Avatar from '@/components/ui/avatar';
import { User } from "@/types/user";

interface ProfileCardProps {
  user?: User | null;
  avatarUrl: string;
  miniAvatarUrl?: string;
  name?: string;
  nickname?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  contactText?: string;
  userId: string;
  currentUserId?: string | null;
  showUserInfo?: boolean;
  onContactClick?: () => void;
}

export default function ProfileCard({
  user,
  avatarUrl,
  miniAvatarUrl,
  name,
  nickname,  
  status,
  userId,
  currentUserId,
}: ProfileCardProps){

  const [followStatus, setFollowStatus] = useState<string>("not_following");
  const [isLoading, setIsLoading] = useState(false);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const isCurrentUser = userId === currentUserId;

useEffect(() => {
  if (!userId) return;

  const fetchPrivacyStatus = async () => {
    try {
      const res = await fetch(`/api/users/${userId}/privacy-status`);
      if (res.ok) {
        const data = await res.json();
        setIsPublic(data.is_public);
      }
    } catch (error) {
      console.error("Error fetching privacy status:", error);
    }
  };

  fetchPrivacyStatus();
}, [userId]);

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-2xl w-full min-h-[550px] bg-gradient-to-br from-black-900 to-black-800">
      {/* Gradient border */}
      <div 
        className="absolute inset-0 rounded-3xl p-[1px]"
        style={{
          background: 'linear-gradient(270deg, #00ffff, #ff00ff, #00ff99, #00ffff)',
          backgroundSize: '300% 300%',
          animation: 'borderFlow 8s ease infinite',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude'
        }}
      ></div>
      {/* Background overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
      
      {/* Main content container */}
      <div className="relative h-full w-full flex flex-col justify-between gap-28 px-6 py-8">
        {/* Name */}
        <div className="text-center space-y-2">
          <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-[#00ff99]">
            {name}
          </h3>
          {isPublic === false && !isCurrentUser && (
            <div className="flex items-center justify-center gap-1 text-sm text-green-300">
              <LockKeyhole className="h-4  w-4" />
              <span>Private Account</span>
            </div>
          )}
        </div>
  
        {/* Avatar */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-[#00ffff] to-[#b1fbff] rounded-full blur-md opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>
            <Avatar
              user={user}
              src={avatarUrl}
              alt={`${name} avatar`}
              size={150}
              className="relative  border-white/10 shadow-sm z-10"
            />
          </div>
          
          {/* Status*/}
          {status && (
            <div className="mt-6 text-center">
              <p className="text-white/80 text-sm font-light">{status}</p>
            </div>
          )}
        </div>
        {/* User Info Section at bottom */}
       <div>
          <div
            className="rounded-xl block bg-white/5 backdrop-blur-lg border border-white/10 p-4  transition-all duration-300 transform"
          >
            <ProfileBottomSection
              user={user}
              miniAvatarUrl={miniAvatarUrl}
              avatarUrl={avatarUrl}
              name={name}
              nickname={nickname}
              status={status}
              userId={userId}
              isCurrentUser={isCurrentUser}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type BottomProps = {
  user?: User | null;
  miniAvatarUrl?: string;
  avatarUrl: string;
  name?: string;
  nickname?: string;
  status?: string;
  isCurrentUser: boolean;
  userId: string;
};

function ProfileBottomSection({ 
  user,
  miniAvatarUrl, 
  avatarUrl, 
  name, 
  nickname, 
  status, 
  isCurrentUser, 
  userId,
}: BottomProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Avatar
          user={user}
          src={miniAvatarUrl || avatarUrl}
          alt={`${name} mini avatar`}
          size={10}
          className="border-2 border-white/20"
        />
        <div>
          <div className="text-sm font-medium text-white">{nickname? nickname : name}</div>
          <div className="text-xs text-white/60">{status}</div>
      </div>
      </div>
      {/* View More Button */}
        <div className="flex-shrink-0">
          {!isCurrentUser && (
            <Link
              href={`/profile/${userId}`}
              className="flex items-center gap-2 p-2 bg-[#00ffff]/10 hover:bg-[#00ffff]/20 border border-[#00ffff]/30 rounded-lg transition-all duration-200 group"
              title="View More"
            >
              <ChevronRight className="h-5 w-5 text-[#00ffff] flex-shrink-0" />
            </Link>
          )}
          {isCurrentUser && (
            <Link
              href={`/profile/${userId}`}
              className="flex items-center gap-2 p-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/30 rounded-lg transition-all duration-200 group"
              title="Edit Profile"
            >
              <Pencil className="h-5 w-5 text-blue-300 flex-shrink-0" />
            </Link>
          )}
        </div>
    </div>
  );
}