import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/router";
import { Label } from "@/components/ui/label";
import Head from "next/head";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import GradientText from "@/components/GradientText";
import ShinyText from "@/components/ShinyText";
import GradientButton from "@/components/GradientButton";
import { useEffect } from "react";
import ShinyLink from "@/components/ShinyLink";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 4000); // 4s then disappear
      return () => clearTimeout(timer); // cleanup if unmounted
    }
  }, [error]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); // clear previous error
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Important to include cookies/sessions
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        const errorData = await res.json();
        setError(errorData.message || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login.");
    }
  };
  
  return (
    <>
      <Head>
        <title>Login</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br  from-black to-gray-900">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >

          <Card className="w-full max-w-sm bg-white/10 backdrop-blur-md shadow-2xl border border-white/20 hover:scale-[1.02] transition-transform duration-300 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-3xl text-center text-white font-semibold">
                <GradientText
                  colors={[
                    "#40ffaa",
                    "#4079ff",
                    "#40ffaa",
                    "#4079ff",
                    "#40ffaa",
                  ]}
                  animationSpeed={10}
                  showBorder={false}
                >
                  _____Hello there 👋_____
                </GradientText>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="error-message"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                    className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-400 text-red-200 text-center text-sm shadow-[0_0_12px_rgba(255,77,79,0.4)]"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <Input
                    id="email"
                    type="email"
                    className="bg-white/20 text-white border-white/30 placeholder:text-[#cbc9c9b5] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white focus:placeholder:scale-110 focus:placeholder:transition-transform focus:placeholder:duration-300"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    required
                    maxLength={30}
                  />
                </div>
                <div>
                  <Input
                    id="password"
                    type="password"
                    className="bg-white/20 text-white border-white/30 placeholder:text-[#cbc9c9b5] placeholder:text-center focus:ring-purple-500 focus:placeholder:text-white focus:placeholder:scale-110 focus:placeholder:transition-transform focus:placeholder:duration-300"
                    autoComplete="off"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    maxLength={20}
                  />
                </div>
                <GradientButton
                  colors={[
                    "#40ffaa",
                    "#4079ff",
                    "#40ffaa",
                    "#4079ff",
                    "#40ffaa",
                  ]}
                  animationSpeed={10}
                  showBorder={false}
                  type="submit"
                  className="w-full text-gradient-to-r from-purple-600 to-indigo-600 text-white"
                >
                  Sign In
                </GradientButton>
              </form>
              <p className="mt-5 text-center text-sm text-white/80">
                <ShinyLink
                  text="no account?"
                  disabled={false}
                  speed={3}
                  className="underline hover:text-purple-300"
                  link="/register"
                />
              </p>
            </CardContent>
          </Card>
        </motion.div>
        
      </div>
      
    </>
    
  );
  
}
