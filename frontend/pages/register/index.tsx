import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import Head from "next/head";
import { useState } from "react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import StepProgress from "@/components/StepProgress";
import ShinyLink from "@/components/ShinyLink";
import GradientButton from "@/components/GradientButton";
import GradientText from "@/components/GradientText";
import { AnimatePresence, motion } from "framer-motion";
import ShinyText from "@/components/ShinyText";
import AvatarSelector from "@/components/AvatarSelector";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    nickname: "",
    aboutMe: "",
    avatar: "",
  });

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 4000); // 4s then disappear
      return () => clearTimeout(timer); // cleanup if unmounted
    }
  }, [error]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value) formData.append(key, value as any);
    });

    const res = await fetch("/api/register", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (res.ok) {
      router.push("/");
    } else {
      const errorData = await res.json();
      setError(errorData.message || "Registration failed");
    }
  };

  const isMandatoryFilled = () =>
    form.email &&
    form.password &&
    form.firstName &&
    form.lastName &&
    form.dateOfBirth;

    const today = new Date().toISOString().split('T')[0];

  return (
    <>
      <Head>
        <title>Sign Up</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-bl from-black to-gray-900 ">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Card className="w-full max-w-xl p-6 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl shadow-xl">
            <CardHeader>
              <StepProgress step={step} />
              <CardTitle className="text-3xl text-center">
                {step === 1 ? (
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
                    className="cursor-pointer"
                  >
                    Register
                  </GradientText>
                ) : (
                  <GradientText
                    colors={[
                      "#2563eb",
                      "#4f46e5",
                      "#2563eb",
                      "#4f46e5",
                      "#2563eb",
                    ]}
                    animationSpeed={9}
                    showBorder={false}
                    className="cursor-pointer"
                  >
                    Optional Stuff
                  </GradientText>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-400 text-red-200 text-center text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
              {step === 1 ? (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (isMandatoryFilled()) setStep(2);
                  }}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        name="firstName"
                        placeholder="First Name"
                        value={form.firstName}
                        required
                        onChange={handleChange}
                        className="bg-white/20 text-white border-white/30 placeholder:text-[#e6e6e6df] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white focus:placeholder:scale-110 focus:placeholder:transition-transform focus:placeholder:duration-300"
                        autoComplete="of"
                        maxLength={10}
                      />
                    </div>
                    <div>
                      <Input
                        name="lastName"
                        placeholder="Last Name"
                        value={form.lastName}
                        required
                        onChange={handleChange}
                        className="bg-white/20 text-white border-white/30 placeholder:text-[#e6e6e6df] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white focus:placeholder:scale-110 focus:placeholder:transition-transform focus:placeholder:duration-300"
                        autoComplete="of"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <div>
                    <Input
                      name="email"
                      type="email"
                      placeholder="Email"
                      value={form.email}
                      required
                      onChange={handleChange}
                      className="bg-white/20 text-white border-white/30 placeholder:text-[#e6e6e6df] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white focus:placeholder:scale-110 focus:placeholder:transition-transform focus:placeholder:duration-300"
                      autoComplete="off"
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <Input
                      name="password"
                      type="password"
                      placeholder="Password"
                      value={form.password}
                      required
                      onChange={handleChange}
                      className="bg-white/20 text-white border-white/30 placeholder:text-[#e6e6e6df] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white focus:placeholder:scale-110 focus:placeholder:transition-transform focus:placeholder:duration-300"
                      autoComplete="off"
                      maxLength={20}
                    />
                  </div>
                  <div>
                    <Input
                      name="dateOfBirth"
                      type="date"
                      placeholder="Date of Birth"
                      value={form.dateOfBirth}
                      max={today}
                      required
                      onChange={handleChange}
                      className="bg-white/20 text-white justify-center border-white/30 placeholder:text-center focus:ring-purple-500"
                    />
                  </div>
                  <GradientButton
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                    colors={[
                      "#4f46e5",
                      "#9333ea",
                      "#4f46e5",
                      "#9333ea",
                      "#4f46e5",
                    ]}
                    animationSpeed={9}
                  >
                    Next
                  </GradientButton>
                  <p className="mt-5 text-center text-sm text-white/80">
                    <ShinyLink
                      text="have an account?"
                      disabled={false}
                      speed={3}
                      className="underline hover:text-purple-300"
                      link="/login"
                    />
                  </p>
                </form>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                  }}
                >
                  <div>
                    <Input
                      name="nickname"
                      placeholder="Nickname"
                      value={form.nickname}
                      onChange={handleChange}
                      className="bg-white/20 text-white border-white/30 placeholder:text-[#e6e6e6df] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white focus:placeholder:scale-110 focus:placeholder:transition-transform focus:placeholder:duration-300"
                      autoComplete="off"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <Textarea
                      placeholder="Tell us about yourself"
                      name="aboutMe"
                      value={form.aboutMe}
                      onChange={handleChange}
                      className="bg-white/20 text-white border-white/30 placeholder:text-[#e6e6e6df] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white focus:placeholder:scale-110 focus:placeholder:transition-transform focus:placeholder:duration-300 resize-none"
                      autoComplete="off"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <Label>Select Your Avatar</Label>
                    <AvatarSelector
                      onSelect={(filename) => {
                        setForm((prev) => ({ ...prev, avatar: filename }));
                      }}
                    />
                  </div>
                  <GradientButton
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                    colors={[
                      "#2563eb",
                      "#4f46e5",
                      "#2563eb",
                      "#4f46e5",
                      "#2563eb",
                    ]}
                    animationSpeed={9}
                  >
                    Sign Up
                  </GradientButton>
                  <div className="flex justify-between gap-4">
                    <Button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-1/4 bg-gray-500 hover:bg-gray-600"
                    >
                      <ShinyText
                        text="Back"
                        disabled={false}
                        speed={3}
                        className=""
                      />
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      className="w-1/4 bg-indigo-500 hover:bg-indigo-600 text-white"
                    >
                      <ShinyText
                        text="Skip"
                        disabled={false}
                        speed={3}
                        className=""
                      />
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
