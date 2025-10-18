import { useState, useEffect } from "react";
import Image from "next/image";
import Head from "next/head";

export default function AvatarSelector({onSelect,selected=""}: { onSelect: (filename: string) => void; selected?: string }) {
  const [gender, setGender] = useState(selected[0]||"M"); // M or F
  const [accessories, setAccessories] = useState({
    C: false, // Cap
    G: false, // Glasses
  });
  const [avatars, setAvatars] = useState([""]);
  const [selectedAvatar, setSelectedAvatar] = useState(selected);

  useEffect(() => {

    const allAvatars = [
      "F1.png",
      "F9.png",
      "M2.png",
      "MCG1.png",
      "F2.png",
      "FC1.png",
      "M3.png",
      "MCG2.png",
      "F3.png",
      "FC2.png",
      "M4.png",
      "MCG3.png",
      "F4.png",
      "FG1.png",
      "M5.png",
      "MG1.png",
      "F5.png",
      "FG2.png",
      "M6.png",
      "MG2.png",
      "F6.png",
      "MB1.png",
      "MG3.png",
      "F7.png",
      "MC1.png",
      "F8.png",
      "M1.png",
      "MC2.png",
    ];
    setAvatars(allAvatars);
  }, []);

  const filteredAvatars = avatars.filter((name) => {
    if (!name.startsWith(gender)) return false;
    for (let k in accessories) {
      const key = k as "C" | "G";
      if (accessories[key] && !name.includes(key)) return false;
    }
    return true;
  });

  const toggleAccessory = (key: 'C' | 'G') => {
    setAccessories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (<>
    <div className="p-4 max-w-lg mx-auto">
      {/* Gender Toggle */}
      <div className="flex justify-center mb-4 gap-4">
        <button
          type="button"
          onClick={() => setGender("M")}
          className={`px-4 py-2 rounded-full ${gender === "M" ? "bg-blue-500 text-gray-" : "bg-gray-200 text-gray-400"}`}
        >
          <svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="m16.79,5.79l-4.32,4.32c-.98-.7-2.18-1.11-3.47-1.11-3.31,0-6,2.69-6,6s2.69,6,6,6,6-2.69,6-6c0-1.29-.42-2.49-1.11-3.47l4.32-4.32,2.79,2.79V3h-7l2.79,2.79Zm-7.79,13.21c-2.21,0-4-1.79-4-4s1.79-4,4-4,4,1.79,4,4-1.79,4-4,4Z"></path></svg>
        </button>
        <button
          type="button"
          onClick={() => setGender("F")}
          className={`px-4 py-2 rounded-full ${gender === "F" ? "bg-pink-500 text-white" : "bg-gray-200 text-gray-400"}`}
        >
          <svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="m12,2c-3.31,0-6,2.69-6,6,0,2.97,2.17,5.43,5,5.91v2.09h-3v2h3v4h2v-4h3v-2h-3v-2.09c2.83-.48,5-2.94,5-5.91,0-3.31-2.69-6-6-6Zm0,10c-2.21,0-4-1.79-4-4s1.79-4,4-4,4,1.79,4,4-1.79,4-4,4Z"></path></svg>
        </button>
      </div>

      {/* Accessories */}
      <div className="flex justify-center mb-4 gap-4">
        <button
          type="button"
          onClick={() => toggleAccessory("C")}
          className={`px-4 py-2 rounded-lg ${accessories.C ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}`}
        >
          <svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="m13.44,3.12c-.17-.64-.75-1.12-1.44-1.12s-1.27.48-1.44,1.12C5.73,3.82,2,7.98,2,13v3c0,.55.45,1,1,1v2.18c0,.91.44,1.77,1.18,2.3.74.53,1.69.67,2.55.37,3.29-1.12,7.25-1.12,10.54,0,.3.1.6.15.91.15.58,0,1.16-.18,1.64-.52.74-.53,1.18-1.39,1.18-2.3v-2.18c.55,0,1-.45,1-1v-3c0-5.02-3.73-9.18-8.56-9.88Zm1.56,9.88v.24c-.91-.14-1.91-.24-3-.24s-2.09.09-3,.24v-.24c0-4.88,1.78-8,3-8s3,3.12,3,8Zm-11,1.85v-1.85c0-3.13,1.81-5.84,4.44-7.15-.9,1.79-1.44,4.29-1.44,7.15v.67c-1.4.39-2.42.87-3,1.18Zm15,4.33c0,.27-.12.51-.34.67-.22.15-.49.19-.74.11-1.85-.63-3.84-.95-5.92-.95s-4.06.32-5.92.95c-.26.09-.53.05-.74-.11-.22-.16-.34-.4-.34-.67v-2.59c.97-.5,3.45-1.58,7-1.58s6.03,1.08,7,1.58v2.59Zm1-4.33c-.58-.31-1.6-.78-3-1.18v-.67c0-2.86-.54-5.37-1.44-7.15,2.63,1.31,4.44,4.02,4.44,7.15v1.85Z"></path></svg>
        </button>
        <button
          type="button"
          onClick={() => toggleAccessory("G")}
          className={`px-4 py-2 rounded-lg ${accessories.G ? "bg-yellow-500 text-white" : "bg-gray-200 text-gray-400"}`}
        >
          <svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">{/* Boxicons v3.0 https://boxicons.com | License  https://docs.boxicons.com/free */}<path d="m21.98,14.78l-1.65-7.43c-.31-1.38-1.51-2.35-2.93-2.35h-1.4v2h1.4c.47,0,.87.32.98.78l.79,3.54c-.51-.21-1.07-.33-1.66-.33-1.95,0-3.6,1.26-4.22,3h-2.55c-.62-1.74-2.27-3-4.22-3-.59,0-1.14.12-1.66.33l.79-3.54c.1-.46.5-.78.98-.78h1.4v-2h-1.4c-1.42,0-2.62.97-2.93,2.35l-1.65,7.43h.05c-.04.24-.07.47-.07.72,0,2.48,2.02,4.5,4.5,4.5,2.31,0,4.2-1.76,4.45-4h2.1c.25,2.24,2.14,4,4.45,4,2.48,0,4.5-2.02,4.5-4.5,0-.24-.03-.47-.07-.71h.05Zm-15.48,3.22c-1.38,0-2.5-1.12-2.5-2.5s1.12-2.5,2.5-2.5,2.5,1.12,2.5,2.5-1.12,2.5-2.5,2.5Zm11,0c-1.38,0-2.5-1.12-2.5-2.5s1.12-2.5,2.5-2.5,2.5,1.12,2.5,2.5-1.12,2.5-2.5,2.5Z"></path></svg>
        </button>
      </div>

      {/* Avatars */}
      <div className="grid grid-cols-4 gap-4 w-[28rem] h-52 max-sm:h-32 overflow-auto">
        {filteredAvatars.map((name, index) => (
          <div
            key={index}
            className={`cursor-pointer h-[80px] w-[80px] p-1 rounded-lg border-2 ${selectedAvatar === name ? "border-blue-500" : "border-transparent"}`}
            onClick={() => {
              setSelectedAvatar(name)
              onSelect(name);
            }}
          >
            <Image
              src={`/avatars/${name}`}
              alt={name}
              width={80}
              height={80}
              className="rounded-full"
            />
          </div>
        ))}
      </div>
    </div>
  </>);
}
