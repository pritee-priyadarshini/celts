"use client"

interface HeaderProps {
  userName?: string
}

export function Header({ userName = "User" }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold"></h2>
        <div className="flex items-center gap-4">
          <span className="text-xl font-semibold">Welcome {userName} </span>
        </div>
      </div>
    </header>
  )
}
