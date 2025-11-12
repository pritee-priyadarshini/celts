"use client"
import { ListeningSection } from "./sections/listening-section"
import { ReadingSection } from "./sections/reading-section"
import { WritingSection } from "./sections/writing-section"
import { SpeakingSection } from "./sections/speaking-section"
import { TestHeader } from "./test-header"
import { Button } from "@/components/ui/button"

interface TestInterfaceProps {
  testId: string
  currentSection: "listening" | "reading" | "writing" | "speaking"
  onSectionChange: (section: "listening" | "reading" | "writing" | "speaking") => void
}

const sections = ["listening", "reading", "writing", "speaking"] as const
const sectionTitles = {
  listening: "Listening (40 mins, 40 questions)",
  reading: "Reading (60 mins, 40 questions)",
  writing: "Writing (60 mins, 2 tasks)",
  speaking: "Speaking (3-4 mins)",
}

export function TestInterface({ testId, currentSection, onSectionChange }: TestInterfaceProps) {
  const sectionIndex = sections.indexOf(currentSection)
  const canGoPrevious = sectionIndex > 0
  const canGoNext = sectionIndex < sections.length - 1

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r border-border bg-sidebar text-sidebar-foreground p-6 overflow-y-auto">
        <h2 className="font-bold text-lg mb-6 text-sidebar-primary">Test Sections</h2>
        <div className="space-y-2">
          {sections.map((section, i) => (
            <button
              key={section}
              onClick={() => onSectionChange(section)}
              className={`w-full text-left p-3 rounded transition ${
                currentSection === section
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent text-sidebar-foreground"
              }`}
            >
              <div className="font-medium text-sm">
                {i + 1}. {sectionTitles[section].split("(")[0]}
              </div>
              <div className="text-xs opacity-75 mt-1">{sectionTitles[section].match(/$$.*$$/)?.[0]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TestHeader section={currentSection} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {currentSection === "listening" && <ListeningSection testId={testId} />}
            {currentSection === "reading" && <ReadingSection testId={testId} />}
            {currentSection === "writing" && <WritingSection testId={testId} />}
            {currentSection === "speaking" && <SpeakingSection testId={testId} />}
          </div>
        </main>

        {/* Navigation Footer */}
        <div className="border-t border-border bg-card p-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => canGoPrevious && onSectionChange(sections[sectionIndex - 1])}
              disabled={!canGoPrevious}
            >
              Previous Section
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Section {sectionIndex + 1} of {sections.length}
            </div>

            <Button onClick={() => canGoNext && onSectionChange(sections[sectionIndex + 1])} disabled={!canGoNext}>
              {canGoNext ? "Next Section" : "Submit Test"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
