
import { BarChart, Users, School, FileText, TrendingUp } from "lucide-react"

export const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: <BarChart className="w-5 h-5" /> },
  { href: "/admin/userManagement", label: "User Management", icon: <Users className="w-5 h-5" /> },
  { href: "/admin/batches", label: "Batch Management", icon: <School className="w-5 h-5" /> },
  { href: "/admin/permissions", label: "Permissions", icon: <FileText className="w-5 h-5" /> },
  { href: "/admin/analytics", label: "Analytics", icon: <TrendingUp className="w-5 h-5" /> },
]
