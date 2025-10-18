"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Avatar from "./avatar";
import { User } from "@/types/user";

interface NavbarProps {
  user: User | null;
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout failed");
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (!user) {
    return;
  }

  return (
    <nav
      className={[
        "fixed top-5 left-1/2 -translate-x-1/2 rounded-full max-sm:px-4 px-8 py-4 flex items-center justify-between z-[1000] w-[90%] max-w-[900px] transition-all",
        scrolled
          ? "shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-[12px] bg-[rgba(30,30,30,0.8)] border border-[rgba(255,255,255,0.1)]"
          : "",
      ].join(" ")}
    >
      <div className="flex gap-8 max-sm:gap-4 items-center">
        <Link
          href="/"
          className="text-white no-underline text-[0.95rem] font-medium transition-all hover:[text-shadow:_0_0_4px_#00ffff,0_0_8px_#ff00ff,0_0_12px_#00ff99]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            fill={"currentColor"}
            viewBox="0 0 24 24"
          >
            {/* Boxicons v3.0 https://boxicons.com | License  https://docs.boxicons.com/free */}
            <path d="m12.71,2.29c-.39-.39-1.02-.39-1.41,0L3.29,10.29c-.19.19-.29.44-.29.71v9c0,1.1.9,2,2,2h4c.55,0,1-.45,1-1v-6h4v6c0,.55.45,1,1,1h4c1.1,0,2-.9,2-2v-9c0-.27-.11-.52-.29-.71L12.71,2.29Zm3.29,17.71v-5c0-1.1-.9-2-2-2h-4c-1.1,0-2,.9-2,2v5h-3v-8.59l7-7,7,7v8.59s-3,0-3,0Z"></path>
          </svg>
        </Link>
        <Link
          href="/messages"
          className="text-white no-underline text-[0.95rem] font-medium transition-all hover:[text-shadow:_0_0_4px_#00ffff,0_0_8px_#ff00ff,0_0_12px_#00ff99]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            fill={"currentColor"}
            viewBox="0 0 24 24"
          >
            {/* Boxicons v3.0 https://boxicons.com | License  https://docs.boxicons.com/free */}
            <path d="M7 9H17V11H7z"></path>
            <path d="M7 13H14V15H7z"></path>
            <path d="m12,2C6.49,2,2,6.49,2,12c0,2.12.68,4.19,1.93,5.9l-1.75,2.53c-.21.31-.24.7-.06,1.03.17.33.51.54.89.54h9c5.51,0,10-4.49,10-10S17.51,2,12,2Zm0,18h-7.09l1.09-1.57c.26-.37.23-.88-.06-1.22-1.25-1.45-1.93-3.3-1.93-5.21,0-4.41,3.59-8,8-8s8,3.59,8,8-3.59,8-8,8Z"></path>
          </svg>
        </Link>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="font-extrabold max-sm:text-xl tracking-[0.4px] brand-title">
          Social Network
        </div>
      </div>

      <div className="flex items-center max-sm:gap-0 gap-2 ml-auto">
        {user.id && (
          <Link
            href={`/profile/${user.id}`}
            className="text-white no-underline text-[0.95rem] font-medium transition-all hover:[text-shadow:_0_0_4px_#00ffff,0_0_8px_#ff00ff,0_0_12px_#00ff99]"
          >
            <Avatar
              user={user}
              size={8}
              color="radial-gradient(circle at 30% 30%, #00ffcc, #66ffff), #00ffcc"
            />
          </Link>
        )}
        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="inline-flex items-center gap-2 px-2 py-2 rounded-[10px] bg-[linear-gradient(180deg,#2a2a2a,#1f1f1f)] text-white cursor-pointer shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)] transition hover:-translate-y-[1px] hover:border-[rgba(255,77,79,.5)] hover:bg-[linear-gradient(180deg,#3a2527,#23181a)] hover:shadow-[0_6px_20px_rgba(255,77,79,.25)]"
        >
          <LogOut size="16" />
        </button>
      </div>
    </nav>
  );
}
