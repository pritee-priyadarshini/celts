"use client"

import { useState } from "react"
import { TestInterface } from "@/components/student/test-interface"

export default function TestPage({ params }: { params: { id: string } }) {
  const [currentSection, setCurrentSection] = useState<"listening" | "reading" | "writing" | "speaking">("listening")

  return (
    <div className="min-h-screen bg-background">
      <TestInterface testId={params.id} currentSection={currentSection} onSectionChange={setCurrentSection} />
    </div>
  )
}
