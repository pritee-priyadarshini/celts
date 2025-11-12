"use client"

import { useEffect, useState } from "react"
import { AlertCircle } from "lucide-react"

interface TestHeaderProps {
  section: "listening" | "reading" | "writing" | "speaking"
}

const sectionDurations = {
  listening: 40,
  reading: 60,
  writing: 60,
  speaking: 4,
}

export function TestHeader({ section }: TestHeaderProps) {
  const [timeRemaining, setTimeRemaining] = useState(sectionDurations[section] * 60)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const isLowTime = timeRemaining < 300

  return (
    <div className="border-b border-border bg-card p-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold capitalize">{section}</h1>
          <p className="text-sm text-muted-foreground mt-1">Answer all questions carefully</p>
        </div>

        <div className="flex items-center gap-4">
          <div className={`text-center p-3 rounded ${isLowTime ? "bg-destructive/10" : "bg-secondary"}`}>
            <p className="text-xs text-muted-foreground">Time Remaining</p>
            <p className={`text-2xl font-bold ${isLowTime ? "text-destructive" : "text-primary"}`}>
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Proctoring Active</span>
          </div>
        </div>
      </div>
    </div>
  )
}
