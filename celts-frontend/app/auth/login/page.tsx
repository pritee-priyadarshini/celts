"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import api from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const res = await api.apiPost("/auth/login", { email, password })
      setIsLoading(false)
      if (!res.ok) {
        setError(res.error?.message || "Login failed")
        return
      }

      const payload = res.data
      const token = payload.token || payload?.token
      const user = payload.user || payload

      if (typeof window !== "undefined") {
        if (token) localStorage.setItem("celts_token", token)
        if (user) localStorage.setItem("celts_user", JSON.stringify(user))
      }

      const role = user?.role || payload?.user?.role
      if (role === "admin") router.push("/admin/dashboard")
      else if (role === "faculty") router.push("/faculty/dashboard")
      else router.push("/student/dashboard")
    } catch (err) {
      setIsLoading(false)
      setError("Network or server error")
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - image */}
      <div className="hidden md:flex w-[60%] relative bg-gray-100">
        <Image
          src="/login-bg.jpg"
          alt="Login background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white text-center"> Welcome to CELTS Portal </h1>
        </div>
      </div>


      {/* Right side - login section */ }
  <div className="flex flex-col w-full md:w-[40%] items-center justify-center bg-white px-10 py-12">
    <div className="mb-8 flex flex-col items-center">
      <Image
        src="/cutm_logo.png"
        alt="CELTS Logo"
        width={180}
        height={180}
        className="mb-8"
      />
      {/* <h2 className="text-3xl font-semibold text-gray-800">CELTS Login</h2> */}
      <h6 className="text-2xl font-semibold text-gray-800">Centurion English Language Testing System</h6>

    </div>

    {/* Login card */}
    <Card className="w-full max-w-lg p-10 shadow-lg space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="email" className="text-base font-medium">Email</Label>
          <Input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-12 text-base"
          />
        </div>

        <div>
          <Label htmlFor="password" className="text-base font-medium">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="h-12 text-base"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </Card>

    {/* Footer */}
    <footer className="mt-10 text-sm text-gray-500 text-center">
      Made with ❤️ by <span className="font-medium text-gray-700">GT Tech Pvt. Ltd.</span>
    </footer>
  </div>
    </div >
  )
}
