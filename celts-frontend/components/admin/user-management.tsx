"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Edit2, Trash2, Lock, Unlock } from "lucide-react"
import api from "@/lib/api"

interface User {
  id: string
  name: string
  email: string
  systemId: string
  role: "admin" | "faculty" | "student"
  status: "active" | "inactive"
  joinDate: string
}

// Helper to safely normalize user status into the exact union type
function normalizeStatus(s: any): "active" | "inactive" {
  return s === "inactive" ? "inactive" : "active";
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRole, setSelectedRole] = useState<string>("all")
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState<Partial<User>>({})

  // Add-user dialog form state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newSystemId, setNewSystemId] = useState("")
  const [newRole, setNewRole] = useState<"admin" | "faculty" | "student">("student")
  const [newIdValue, setNewIdValue] = useState("") // employeeId or rollNo
  const [newCanEditScores, setNewCanEditScores] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addMessage, setAddMessage] = useState<string | null>(null)

  // Bulk upload
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    // Fetch users from backend; if it fails, leave users empty
    const fetchUsers = async () => {
      setLoadingUsers(true)
      try {
        const res = await api.apiGet("/admin/users")
        if (res.ok && Array.isArray(res.data)) {
          const data: User[] = res.data.map((u: any) => ({
            id: u._id || u.id || String(Math.random()),
            name: u.name || "",
            email: u.email || "",
            systemId: u.systemId || "",
            role: (u.role || "student") as "admin" | "faculty" | "student",
            status: normalizeStatus(u.isActive === false ? "inactive" : (u.status ?? "active")),
            joinDate: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          }))
          setUsers(data)
        } else {
          setUsers([])
        }
      } catch (err) {
        console.error("Failed to fetch users:", err)
        setUsers([])
      } finally {
        setLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [])

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === "all" || user.role === selectedRole
    return matchesSearch && matchesRole
  })

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setEditFormData({ ...user })
    setIsDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    const id = editingUser.id;
    const payload: any = {
      name: editFormData.name,
      email: editFormData.email,
      systemId: editFormData.systemId,
      role: editFormData.role,
    };

    try {
      // optimistic UI disabled until server confirms
      const res = await api.apiPut(`/admin/users/${id}`, payload);
      if (!res.ok) {
        console.error('Failed update user', res);
        // show simple alert/message - you can improve UI later
        alert(res.error?.message || 'Failed to update user');
        return;
      }
      const updated = res.data?.user || res.data;
      setUsers(users.map(u => u.id === id ? {
        id: updated._id || updated.id || id,
        name: updated.name,
        email: updated.email,
        systemId: updated.systemId,
        role: updated.role,
        status: normalizeStatus(updated.isActive === false ? 'inactive' : (updated.status ?? 'active')),
        joinDate: updated.createdAt ? new Date(updated.createdAt).toISOString().slice(0, 10) : u.joinDate
      } : u));
      setIsDialogOpen(false);
      setEditingUser(null);
    } catch (err) {
      console.error('Error saving edit', err);
      alert('Network error while updating user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
  const ok = confirm('Are you sure you want to delete this user? This action cannot be undone.');
  if (!ok) return;

  try {
    const res = await api.apiDelete(`/admin/users/${userId}`);

    console.log('[Delete] api response object:', res);
    

    if (!res.ok) {
      const serverMessage =
        res.error?.message ||
        (typeof res.error === 'string' ? res.error : null) ||
        (res.data && res.data.message) ||
        `Server returned ${res.status || 'an unknown status'}`;
      console.error('Delete failed ->', { status: res.status, serverMessage, raw: res });
      alert(`Failed to delete user: ${serverMessage}`);
      return;
    }
    console.log("[Delete] response full:", JSON.stringify(res, null, 2));
    setUsers(prev => prev.filter(u => u.id !== userId));
    alert('User deleted successfully.');
  } 
  catch (err) {
    console.error('Network or unexpected error while deleting user', err);
    alert('Network error while deleting user. See console for details.');
  }
  
};




  // ---------- Add single user (calls backend /admin/users) ----------
  const openAddDialog = () => {
    setNewName("")
    setNewEmail("")
    setNewIdValue("")
    setNewRole("student")
    setNewCanEditScores(false)
    setAddMessage(null)
    setIsAddOpen(true)
  }

  const handleCreateUser = async () => {
    setAddMessage(null)
    if (!newName || !newEmail || !newIdValue) {
      setAddMessage("Please fill name, email and the ID (rollNo or employeeId).")
      return
    }
    setAddLoading(true)
    try {
      const payload: any = {
        name: newName,
        email: newEmail,
        systemId: newSystemId,
        password: newIdValue, // admin sets password as rollNo or employeeId
        role: newRole,
      }
      if (newRole === "faculty") payload.canEditScores = newCanEditScores

      const res = await api.apiPost("/admin/users", payload)
      setAddLoading(false)
      if (!res.ok) {
        setAddMessage(res.error?.message || "Failed to create user")
        return
      }

      const created = res.data?.user || res.data || null
      if (created) {
        const newUser: User = {
          id: created._id || String(Math.random()),
          name: created.name || newName,
          email: created.email || newEmail,
          systemId: created.systemId || newSystemId,
          role: (created.role || newRole) as "admin" | "faculty" | "student",
          status: normalizeStatus(created.status ?? (created.isActive === false ? "inactive" : "active")),
          joinDate: created.createdAt ? new Date(created.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        }
        setUsers((prev) => [newUser, ...prev])
      } else {
        const newUser: User = {
          id: String(Math.random()),
          name: newName,
          email: newEmail,
          systemId: newSystemId,
          role: newRole,
          status: "active",
          joinDate: new Date().toISOString().slice(0, 10),
        }
        setUsers((prev) => [newUser, ...prev])
      }
      setAddMessage("User created successfully.")
      setIsAddOpen(false)
    } catch (err) {
      setAddLoading(false)
      setAddMessage("Network error while creating user.")
      console.error(err)
    }
  }

  // ---------- Bulk upload CSV ----------
  async function handleBulkFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setBulkMessage(null)
    const file = e.target.files?.[0]
    if (!file) return
    setBulkLoading(true)
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(Boolean)
      if (lines.length < 2) {
        setBulkMessage("CSV seems empty or missing rows.")
        setBulkLoading(false)
        return
      }
      const headers = lines[0].split(",").map(h => h.trim())
      const rows = lines.slice(1)
      const arr: any[] = rows.map(r => {
        const cols = r.split(",")
        const obj: any = {}
        headers.forEach((h, i) => { obj[h] = (cols[i] || "").trim() })
        return obj
      })

      // Map CSV columns to backend expected fields
      let payload: any[] = []
      if (headers.includes("rollNo") || !headers.includes("employeeId")) {
        // treat as students
        payload = arr.map((r) => ({ name: r.name, email: r.email, password: r.rollNo || r.roll_no || r.roll, role: "student" }))
      } else {
        // treat as faculty
        payload = arr.map((r) => ({ name: r.name, email: r.email, password: r.employeeId || r.employee_id || r.empId, role: "faculty", canEditScores: (String(r.canEditScores || "").toLowerCase() === "true") }))
      }

      const res = await api.apiPost("/admin/bulk/users", payload)
      setBulkLoading(false)
      if (!res.ok) {
        setBulkMessage(res.error?.message || "Bulk upload failed")
        return
      }

      const appended: User[] = payload.map((p: any) => ({
        id: String(Math.random()),
        name: p.name || "",
        email: p.email || "",
        systemId: p.systemId || "",
        role: (p.role || "student") as "admin" | "faculty" | "student",
        status: normalizeStatus(p.status ?? "active"),
        joinDate: new Date().toISOString().slice(0, 10),
      }))

      setUsers(prev => [...appended, ...prev])
      setBulkMessage(`Bulk upload successful (${payload.length} records).`)
    } catch (err) {
      setBulkLoading(false)
      console.error(err)
      setBulkMessage("Failed to read or parse file. Ensure it's a CSV with proper headers.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="px-3 py-2 border border-border rounded bg-background"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="faculty">Faculty</option>
          <option value="student">Student</option>
        </select>

        {/* Add User Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account for the platform</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm block mb-1">Full Name</label>
                <Input placeholder="Full Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>

              <div>
                <label className="text-sm block mb-1">Email Address</label>
                <Input type="email" placeholder="Email Address" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>

              <div>
                <label className="text-sm block mb-1">Enter Id</label>
                <Input placeholder="Id" value={newSystemId} onChange={(e) => setNewSystemId(e.target.value)} />
              </div>

              <div>
                <label className="text-sm block mb-1">Select Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className="w-full px-3 py-2 border border-border rounded bg-background">
                  <option value="admin">Admin</option>
                  <option value="faculty">Faculty</option>
                  <option value="student">Student</option>
                </select>
              </div>

              <div>
                <label className="text-sm block mb-1">{newRole === "faculty" ? "Password" : "Student Roll Number Can be Password"}</label>
                <Input value={newIdValue} onChange={(e) => setNewIdValue(e.target.value)} />
              </div>

              {newRole === "faculty" && (
                <div className="flex items-center gap-2">
                  <input id="canEdit" type="checkbox" checked={newCanEditScores} onChange={(e) => setNewCanEditScores(e.target.checked)} />
                  <label htmlFor="canEdit" className="text-sm">Faculty can edit/override scores</label>
                </div>
              )}

              {addMessage && <div className="text-sm text-red-600">{addMessage}</div>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateUser} disabled={addLoading}>{addLoading ? "Saving..." : "Create User"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk upload input */}
        <div className="flex items-center gap-2">
          <label className="cursor-pointer inline-flex items-center px-3 py-2 border border-border rounded bg-background">
            <input type="file" accept=".csv" onChange={handleBulkFileChange} className="hidden" />
            <span className="text-sm">Upload CSV</span>
          </label>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">System ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Role</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Join Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingUsers ? (
                <tr><td colSpan={6} className="p-6 text-center">Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center">No users found.</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-6 py-4 text-sm">{user.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{user.email}</td>
                  <td className="px-6 py-4 text-sm">{user.systemId}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs font-medium capitalize">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${user.status === "active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{user.joinDate}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {bulkLoading && <div className="text-sm">Uploading CSV...</div>}
      {bulkMessage && <div className="text-sm text-green-700">{bulkMessage}</div>}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and permissions</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Name</label>
                <Input
                  value={editFormData.name || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input
                  type="email"
                  value={editFormData.email || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">System Id</label>
                <Input
                  value={editFormData.systemId || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, systemId: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Role</label>
                <select
                  value={editFormData.role || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-border rounded bg-background"
                >
                  <option value="admin">Admin</option>
                  <option value="faculty">Faculty</option>
                  <option value="student">Student</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

