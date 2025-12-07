// pages/profile/edit.tsx
import { useEffect, useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import GradientButton from "@/components/GradientButton";
import GradientText from "@/components/GradientText";
import ShinyText from "@/components/ShinyText";
import AvatarSelector from "@/components/AvatarSelector";
import Navbar from "@/components/ui/navbar";
import { ToastContainer, toast } from "react-toastify";
import { User } from "@/types/user";

type EditForm = {
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
  nickname: string;
  aboutMe: string;
  avatar: string;
};

export default function EditProfilePage() {
  const router = useRouter();

  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<EditForm>({
    firstName: "",
    lastName: "",
    email: "",
    dob: "",
    nickname: "",
    aboutMe: "",
    avatar: "",
  });

  const today = new Date().toISOString().split("T")[0];

  // Load current user and pre-fill the form
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();

        // Defensive mapping: accept different field names the backend might use
        const firstName =
          data.firstName ??
          data.firstname ??
          data.first_name ??
          "";
        const lastName =
          data.lastName ??
          data.last_Name ??
          data.last_name ??
          "";
        const email =
          data.email ?? "";
        const dob =
          data.dob ??
          data.dateOfBirth ??
          data.date_of_birth ??
          "";
        const nickname =
          data.nickname ?? "";
        const aboutMe =
          data.aboutMe ??
          data.about_me ??
          "";
        const avatar =
          data.avatar ?? "";

        setMe(data);
        setForm({
          firstName,
          lastName,
          email,
          dob,
          nickname,
          aboutMe,
          avatar,
        });
      } catch (err) {
        console.error("Failed to load profile", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  // Auto-clear error after some time
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!me || saving) return; // avoid double submission

    setSaving(true);
    try {
      // IMPORTANT: your CORS only allows GET, POST, DELETE, OPTIONS
      // so we use POST, not PUT
      const res = await fetch("/api/me", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          dob: form.dob,
          nickname: form.nickname,
          aboutMe: form.aboutMe,
          avatar: form.avatar,
          // You can also send a flag if you want to distinguish from "GET"
          // e.g. mode: "update"
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.message || "Failed to update profile";
        setError(msg);
        toast.error(msg);
        return;
      }

      const updated = await res.json().catch(() => null);
      toast.success("Profile updated");

      const userId = updated?.id || me.id;
      router.push(`/profile/${userId}`);
    } catch (err) {
      console.error("Error saving profile", err);
      const msg = "An error occurred while saving";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (me?.id) router.push(`/profile/${me.id}`);
    else router.push("/");
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-black flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Edit Profile</title>
      </Head>

      <div className="w-full min-h-screen mx-auto p-4 md:p-8 bg-black flex justify-center items-center relative overflow-hidden">
        {/* Neon BG */}
        <div
          aria-hidden="true"
          className="fixed -inset-[50vh] z-0 pointer-events-none blur-[20px] saturate-[1.2] animate-[glowMove_28s_linear_infinite]"
          style={{
            background: `
              radial-gradient(42rem 42rem at 20% 25%, rgba(0,255,255,0.12), transparent 60%),
              radial-gradient(36rem 36rem at 80% 70%, rgba(255,0,255,0.10), transparent 60%),
              radial-gradient(30rem 30rem at 60% 30%, rgba(0,255,153,0.10), transparent 60%),
              radial-gradient(24rem 24rem at 40% 80%, rgba(0,140,255,0.08), transparent 60%)
            `,
          }}
        />

        <Navbar user={me} />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-2xl mt-20"
        >
          <Card className="w-full p-6 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl shadow-xl">
            <CardHeader>
              <CardTitle className="text-3xl text-center">
                <GradientText
                  colors={[
                    "#4f46e5",
                    "#9333ec",
                    "#4f46e5",
                    "#9333ec",
                    "#4f46e5",
                  ]}
                  animationSpeed={9}
                  showBorder={false}
                  className="cursor-default"
                >
                  Edit Profile
                </GradientText>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-400 text-red-200 text-center text-sm">
                  {error}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-white/80 mb-1 block">
                      First Name
                    </Label>
                    <Input
                      name="firstName"
                      placeholder="First Name"
                      value={form.firstName}
                    //   required
                      onChange={handleChange}
                      className="bg-white/20 text-white border-white/30 placeholder:text-[#e6e6e6df] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white"
                      autoComplete="off"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-white/80 mb-1 block">
                      Last Name
                    </Label>
                    <Input
                      name="lastName"
                      placeholder="Last Name"
                      value={form.lastName}
                    //   required
                      onChange={handleChange}
                      className="bg-white/20 text-white border-white/30 placeholder:text-[#e6e6e6df] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white"
                      autoComplete="off"
                      maxLength={10}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <Label className="text-sm text-white/80 mb-1 block">
                    Email
                  </Label>
                  <Input
                    name="email"
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    // required
                    onChange={handleChange}
                    className="bg-white/20 text-white border-white/30 placeholder:text-[#e6e6e6df] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white"
                    autoComplete="off"
                    maxLength={50}
                  />
                </div>

                {/* DOB & Nickname */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-white/80 mb-1 block">
                      Date of Birth
                    </Label>
                    <Input
                      name="dob"
                      type="date"
                      value={form.dob || ""}
                      max={today}
                    //   required
                      onChange={handleChange}
                      className="bg-white/20 text-white justify-center border-white/30 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-white/80 mb-1 block">
                      Nickname (optional)
                    </Label>
                    <Input
                      name="nickname"
                      placeholder="Nickname"
                      value={form.nickname}
                      onChange={handleChange}
                      className="bg-white/20 text-white border-white/30 placeholder:text-[#e6e6e6df] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white"
                      autoComplete="off"
                      maxLength={10}
                    />
                  </div>
                </div>

                {/* About */}
                <div>
                  <Label className="text-sm text-white/80 mb-1 block">
                    About Me (optional)
                  </Label>
                  <Textarea
                    placeholder="Tell us about yourself"
                    name="aboutMe"
                    value={form.aboutMe}
                    onChange={handleChange}
                    className="bg-white/20 text-white border-white/30 placeholder:text-[#e6e6e6df] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white resize-none"
                    autoComplete="off"
                    maxLength={200}
                    rows={3}
                  />
                </div>

                {/* Avatar */}
                <div>
                  <Label className="text-sm text-white/80 mb-2 block">
                    Avatar
                  </Label>
                  <AvatarSelector
                    onSelect={(filename) =>
                      setForm((prev) => ({ ...prev, avatar: filename }))
                    }
                    selected={form.avatar || ""}
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <GradientButton
                    type="submit"
                    className="w-full sm:w-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                    colors={[
                      "#4f46e5",
                      "#9333ea",
                      "#4f46e5",
                      "#9333ea",
                      "#4f46e5",
                    ]}
                    animationSpeed={9}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </GradientButton>

                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-full sm:w-1/2 border border-white/30 rounded-lg bg-white/5 text-white py-2.5 hover:bg-white/10 transition"
                  >
                    <ShinyText
                      text="Cancel"
                      disabled={false}
                      speed={3}
                      className=""
                    />
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <ToastContainer
          position="bottom-left"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
      </div>
    </>
  );
}
