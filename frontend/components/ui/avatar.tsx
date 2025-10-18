import { UserProfile,User } from "@/types/user";
import { useState } from "react";

interface AvatarProps {
  user?: User | null;
  size?: number;
  src?: string;
  alt?: string;
  initials?: string;
  color?: string;
  className?: string;
}

const Avatar = ({ user, size = 8,src, alt, initials,  color = "radial-gradient(circle at 30% 30%, #00ffcc, #66ffff), #00ffcc", className }: AvatarProps) => {
const rawUrl =
  src ??
  (user?.avatar
    ? (user.avatar.startsWith('/') ? user.avatar : `/avatars/${user.avatar}`)
    : null);

const isPlaceholder = (u?: string | null) => {
  if (!u) return false;
  const p = u.toLowerCase();
  const names = [
    'avatar.jpeg', 'avatar.jpg', 'avatar.png',
    'default.jpeg', 'default.jpg', 'default.png',
    'placeholder.png', 'placeholder.jpg', 'placeholder.jpeg'
  ];
  return names.some(n => p.endsWith(`/avatars/${n}`) || p.endsWith(n));
};

const avatarUrl = isPlaceholder(rawUrl) ? null : rawUrl;

  
const primaryName =
  initials ||
  user?.nickname ||
  user?.name ||
  [
    (user as any)?.firstName ?? (user as any)?.firstName ?? (user as any)?.firstName ?? '',
    (user as any)?.lastName ?? (user as any)?.lastName ?? (user as any)?.lastName ?? '',
  ].join(' ').trim();

const displayInitial = primaryName ? primaryName[0]!.toUpperCase() : '?';
const Alt = alt || primaryName || 'Avatar';

const [imgFailed, setImgFailed] = useState(false);
const showImage = !!avatarUrl && !imgFailed;
  const sizeClass = (n?: number) =>
  ({ 6: 'w-6 h-6', 8: 'w-8 h-8', 10: 'w-10 h-10', 12: 'w-12 h-12' }[n || 8]) || 'w-8 h-8';
  const TW_SIZES: Record<number, string> = { 6:'w-6 h-6', 8:'w-8 h-8', 10:'w-10 h-10', 12:'w-12 h-12' };
const isTwSize = size in TW_SIZES;
const boxClass = isTwSize ? TW_SIZES[size] : '';
const boxStyle = isTwSize ? undefined : { width: `${size}px`, height: `${size}px` };

const fontSize = isTwSize ? undefined : Math.max(12, Math.round((size ?? 40) * 0.35));
  return (
  <div className={`rounded-full relative ${boxClass} ${className ?? ''}`} style={boxStyle}>
{showImage && (
  <img
    src={avatarUrl as string}
    alt={Alt}
    className="w-full h-full rounded-full object-cover"
    onError={() => setImgFailed(true)}
  />
)}
{!showImage && (
  <div
    className="w-full h-full rounded-full flex items-center justify-center font-bold uppercase text-black shadow-[0_0_10px_rgba(0,255,255,.25)]"
    style={{ background: color, fontSize }}
  >
    {displayInitial}
  </div>
)}

    </div>
  );
};

export default Avatar