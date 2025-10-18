import React, { useState, useEffect } from "react";
import {
  MessageCircle,
  UserRoundPlus,
  LockKeyhole,
  LockKeyholeOpen,
  Pencil,
  UserRoundMinus,
  UserRoundX,
  Sparkles,
  Sparkle,
} from "lucide-react";
import UserList from "./ProfileUserList";
import AvatarSelector from "../AvatarSelector";
import CircleAvatar from '@/components/ui/CircleAvatar';
import { useRouter } from "next/router";

interface InfoCardProps {
  avatarUrl?: string;
  name?: string;
  email?: string;
  dob?: string;
  about?: string;
  nickname?: string;
  postCount?: number;
  userId?: string;
  currentUserId?: string | null;
  isPublic?: boolean | null;
  onTogglePrivacy?: () => void;
  followerCount?: number;
  followingCount?: number;
  onFollowUpdate?: () => void;
  canViewProfile?: boolean;
  showUserInfo?: boolean; //use to prevent non-followers view private accounts
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string;
}

export default function InfoCard({
  avatarUrl,
  name,
  email,
  dob,
  about,
  nickname,
  postCount,
  userId = "",
  currentUserId,
  isPublic,
  onTogglePrivacy,
  followerCount = 0,
  followingCount = 0,
  onFollowUpdate,
  canViewProfile = false,
}: InfoCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [followStatus, setFollowStatus] = useState<string>("not_following");
  const avatar = avatarUrl;
  const firstName = name?.split(" ")[0] || "";
  const lastName = name?.split(" ")[1] || "";
  const nickName = nickname || "";
  const aboutMe = about || "";
  const displayName =
    (nickname && nickname.trim()) ||
    (name && name.trim()) ||
    "";
  const initial = displayName ? displayName[0].toUpperCase() : "?";

  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  const isCurrentUser = userId === currentUserId;

  const router = useRouter();


  //fetch followers list
  const fetchFollowers = async () => {
    if (!userId) return;

    setLoadingFollowers(true);

    try {
      const res = await fetch(`/api/users/${userId}/followers`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setFollowers(data.followers || []);
      }
    } catch (error) {
      console.error("Error fetching followers:", error);
    } finally {
      setLoadingFollowers(false);
    }
  };

  //fetch following list
  const fetchFollowing = async () => {
    if (!userId) return;

    setLoadingFollowing(true);

    try {
      const res = await fetch(`/api/users/${userId}/followings`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setFollowing(data.followings || []);
        console.log("followings: ", data.followings);
      }
    } catch (error) {
      console.error("Error fetching following:", error);
    } finally {
      setLoadingFollowing(false);
    }
  };

  //open followers list
  const handleOpenFollowerList = () => {
    setShowFollowersList(true);
    fetchFollowers();
  };

  //open followings list
  const handleOpenFollowingList = () => {
    setShowFollowingList(true);
    fetchFollowing();
  };

  const refreshFollowStatus = async () => {
    if (!userId || !currentUserId || isCurrentUser) return;

    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/users/follow-status?following_id=${userId}`,
        {
          credentials: "include",
        }
      );

      if (res.ok) {
        const data = await res.json();
        setFollowStatus(data.status);

      }
    } catch (error) {
      console.error("Error refreshing follow status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // This will re-run when the component gets re-rendered with a new key
    if (userId && currentUserId && !isCurrentUser) {
      refreshFollowStatus();
    }
  }, [userId, currentUserId, isCurrentUser]);

  useEffect(() => {
    if (!userId) return;

    const fetchProfileAccess = async () => {
      try {
        setIsLoading(true);
        //if use never logged in, check that profile is public OR PREVENT ACCESS
        if (!currentUserId) {
          return;
        }

        // If it's current user's own profile, always allow access
        if (isCurrentUser) {
          return;
        }

        const followRes = await fetch(
          `/api/users/follow-status?following_id=${userId}`,
          {
            credentials: "include",
          }
        );

        if (followRes.ok) {
          const followData = await followRes.json();
          setFollowStatus(followData.status);
        }
      } catch (error) {
        console.error("Error fetching profile access info:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileAccess();
  }, [userId, currentUserId, isPublic, isCurrentUser, followStatus]);

  useEffect(() => {
    if (!userId || !currentUserId || isCurrentUser) return;

    const fetchFollowStatus = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(
          `/api/users/follow-status?following_id=${userId}`,
          {
            credentials: "include",
          }
        );

        if (res.ok) {
          const data = await res.json();
          setFollowStatus(data.status);
        }
      } catch (error) {
        console.error("Error fetching follow status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowStatus();

  }, [userId, currentUserId, isCurrentUser])



  const handleFollow = async () => {

    if (!userId || isCurrentUser) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/users/follow`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ following_id: userId })
        }
      )

      if (res.ok) {
        const data = await res.json()
        setFollowStatus(data.status)
        onFollowUpdate?.(); //to refresh both counts
      } else {
        console.error("Failed to follow user:", res.status);
      }
    } catch (error) {
      console.error("Error following user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!userId || isCurrentUser) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/users/unfollow`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ following_id: userId }),
      });

      if (res.ok) {
        setFollowStatus("not_following");
        onFollowUpdate?.(); //refresh counts
        console.log("unfollowed, follower amount is : ", followerCount);
      } else {
        console.error("Failed to unfollow user:", res.status);
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFollowBtn = () => {
    //user cannot follow himself
    if (isCurrentUser) return null;

    switch (followStatus) {
      case "accepted":
        return (
          <button
            onClick={handleUnfollow}
            disabled={isLoading}
            className="p-2 rounded-lg cursor-pointer"
            title="Unfollow"
          >
            <UserRoundX className="h-8 w-8 text-red-400 hover:text-red-500" />
          </button>
        );

      case "pending":
        return (
          <button
            onClick={handleUnfollow}
            className="p-2 rounded-lg"
            title="Request Pending"
          >
            <UserRoundMinus className="h-8 w-8 text-yellow-400 hover:text-yellow-500" />
          </button>
        );

      default:
        return (
          <button
            onClick={handleFollow}
            disabled={isLoading}
            className="p-2 rounded-lg cursor-pointer transition-colors"
            title="Follow"
          >
            <UserRoundPlus className="h-8 w-8 text-blue-400 hover:text-blue-500" />
          </button>
        );
    }
  };

  return (
    <div
      className={`relative rounded-3xl overflow-hidden backdrop-blur-sm border border-[#8dffe893] shadow-lg min-h-[600px] w-full`}
    >
      {/* Main content with conditional blur */}

      <div
        className={`${(!canViewProfile && !isCurrentUser ? "blur-xl" : "")} transition-all duration-300 relative z-10`}
      >
        <div className="flex flex-col">
          {/* Avatar Section */}
          <div className="flex-1 flex items-center justify-center p-8">
            <CircleAvatar
              src={avatarUrl}
              title={nickname || name}
              size={160}
              className="border-4 border-white/30 shadow-2xl"
              alt={`${name} avatar`}
            />
          </div>


          {/* Name,nickname, Email, DOB Section */}
          <div className="px-6 text-center space-y-1">
            <div className="flex flex-row justify-center items-center gap-3">

              <h3 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                {name}
              </h3>

              <button
                onClick={
                  isCurrentUser
                    ? () => {
                      setIsLoading(true);
                      onTogglePrivacy?.();
                      setIsLoading(false);
                    }
                    : undefined
                }
                disabled={isLoading || !isCurrentUser}
                className="focus:outline-none"
                title="Change privacy status"
              >
                {isPublic === true ? (
                  <LockKeyholeOpen
                    className={`h-8 w-8 text-white ${!isCurrentUser ? "cursor-default" : "cursor-pointer hover:text-gray-300"}`}
                  />
                ) : isPublic === false ? (
                  <LockKeyhole
                    className={`h-8 w-8 text-white ${!isCurrentUser ? "cursor-default" : "cursor-pointer hover:text-gray-300"}`}
                  />
                ) : (
                  <div className="h-8 w-8 animate-pulse bg-gray-400 rounded-full" />
                )}
              </button>
            </div>

            <h2 className="text-lg text-white font-bold">aka {nickname}</h2>

            <p className="text-sm text-transparent bg-clip-text bg-gradient-to-r from-white/80 to-blue-100/80">
              {email}
            </p>
            <p className="text-xs text-white/60">
            {dob ? `Born on ${new Date(dob).toLocaleDateString()}` : "Date of birth not provided"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 p-4 justify-center">
            {getFollowBtn()}
            {!isCurrentUser && (
              <button
                className="p-2 rounded-lg transition-colors"
                title="Message"
                onClick={() => {
                localStorage.setItem('intent:openDM', userId);
                router.push('/messages');
              }}
              >
                <MessageCircle className="h-7 w-7 text-purple-300 hover:text-purple-400" />
              </button>
            )}


          </div>

          {/* About Me Section */}
          <div className="p-6">
            <h2 className="text-xl font-bold text-white mb-3">About Me</h2>
            <p className="text-white/80 min-h-[100px]">
              {about || "User hasn't written anything about themselves yet."}
            </p>
          </div>

          {/* Divider line */}
          <div className="border-t border-white/10 mx-6"></div>
          {/* Stats Section */}
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 text-center bg-white/5 rounded-lg border border-[#8dffe866]">
                <p className="text-xs text-white/80 mb-1">Posts</p>
                <p className="text-3xl font-bold text-white">
                  {postCount || 0}
                </p>
              </div>
              <div
                className="p-4 text-center bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors border border-[#8dffe866]"
                onClick={handleOpenFollowerList}
              >
                <p className="text-xs text-white/80 mb-1">Followers</p>
                <p className="text-3xl font-bold text-white">{followerCount}</p>
              </div>

              <div
                className="p-4 text-center bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors border border-[#8dffe893]"
                onClick={handleOpenFollowingList}
              >
                <p className="text-xs text-white/80 mb-1">Following</p>
                <p className="text-3xl font-bold text-white">
                  {followingCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        <UserList
          isOpen={showFollowersList}
          onClose={() => setShowFollowersList(false)}
          title="Followers"
          users={followers}
          loading={loadingFollowers}
          currentUserId={currentUserId}
        />

        <UserList
          isOpen={showFollowingList}
          onClose={() => setShowFollowingList(false)}
          title="Following"
          users={following}
          loading={loadingFollowing}
          currentUserId={currentUserId}
        />
      </div>

      {/* Overlay for private accounts */}
      {!canViewProfile && !isCurrentUser && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-2xl rounded-3xl z-20">
          <LockKeyhole className="h-16 w-16 text-indigo-900 mb-4" />
          <p className="text-xl text-white font-bold mb-1">Private Account</p>
          <p className="text-white/60 text-center mb-2">
            Follow to view content
          </p>
          <div className="flex">
            {getFollowBtn()}
          </div>
        </div>
      )}
    </div>
  );
}
