"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
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
      // res.data should contain { token, user } or { token, user } depending on backend
      const payload = res.data
      const token = payload.token || payload.token || (payload?.token)
      const user = payload.user || payload
      // Save token and user
      if (typeof window !== "undefined") {
        if (token) localStorage.setItem("celts_token", token)
        if (user) localStorage.setItem("celts_user", JSON.stringify(user))
      }
      // redirect based on role
      const role = user?.role || (payload?.user?.role)
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
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-2xl font-semibold mb-4 text-center">Sign in</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

      </Card>
    </div>
  )
}
