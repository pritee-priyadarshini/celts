"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, UserPlus, Pencil, Trash2, ChevronDown } from "lucide-react";

type Batch = {
  _id: string;
  name: string;
  program?: string;
  year?: number;
  section?: string;
  faculty?: string[]; // in GET this may be names array
  students?: any[]; // may be array of strings OR array of objects
  createdAt?: string;
};

type UserOption = { id: string; name: string; email?: string; systemId?: string };

export function BatchManagement() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For create batch dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProgram, setNewProgram] = useState("");
  const [newYear, setNewYear] = useState<number | "">("");
  const [newSection, setNewSection] = useState("");

  // For assigning
  const [facultyOptions, setFacultyOptions] = useState<UserOption[]>([]);
  const [studentOptions, setStudentOptions] = useState<UserOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  // Edit batch dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);

  // ---------- NEW: Student-list dialog state ----------
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [studentListForDialog, setStudentListForDialog] = useState<
    { id?: string; name: string; systemId?: string }[]
  >([]);
  const [currentDialogBatchId, setCurrentDialogBatchId] = useState<string | null>(null);
  const [studentsDialogLoading, setStudentsDialogLoading] = useState(false);
  const [studentsDialogError, setStudentsDialogError] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    fetchFacultyOptions();
    fetchStudentOptions();
  }, []);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet("/admin/batches");
      if (!res.ok) {
        setError(res.error?.message || "Failed to load batches");
        setBatches([]);
        return;
      }
      setBatches(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load batches");
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFacultyOptions() {
    try {
      const res = await api.apiGet("/admin/users?role=faculty");
      if (!res.ok) return;
      const opts = (res.data || []).map((u: any) => ({
        id: u._id || u.id,
        name: u.name,
        systemId: u.systemId,
      }));
      setFacultyOptions(opts);
    } catch {}
  }

  async function fetchStudentOptions() {
    try {
      const res = await api.apiGet("/admin/users?role=student");
      if (!res.ok) return;
      const opts = (res.data || []).map((u: any) => ({
        id: u._id || u.id,
        name: u.name,
        systemId: u.systemId,
      }));
      setStudentOptions(opts);
    } catch {}
  }

  // Create batch
  const handleCreateBatch = async () => {
    setError(null);
    if (!newName.trim()) {
      setError("Batch name is required");
      return;
    }
    try {
      const payload = {
        name: newName.trim(),
        program: newProgram || undefined,
        year: newYear || undefined,
        section: newSection || undefined,
      };
      const res = await api.apiPost("/admin/batches", payload);
      if (!res.ok) {
        setError(res.error?.message || "Failed to create batch");
        return;
      }
      setIsCreateOpen(false);
      setNewName("");
      setNewProgram("");
      setNewYear("");
      setNewSection("");
      await fetchAll();
    } catch (err: any) {
      setError(err.message || "Failed to create batch");
    }
  };

  // Edit batch
  const handleEditBatch = async () => {
    if (!editBatch) return;
    try {
      const res = await api.apiPut(`/admin/batches/${editBatch._id}`, {
        name: editBatch.name,
        program: editBatch.program,
        year: editBatch.year,
        section: editBatch.section,
      });
      if (!res.ok) {
        alert(res.error?.message || "Failed to update batch");
        return;
      }
      setIsEditOpen(false);
      await fetchAll();
    } catch (err: any) {
      alert(err.message || "Error updating batch");
    }
  };

  // Delete batch
  const handleDeleteBatch = async (id: string) => {
    if (!confirm("Are you sure you want to delete this batch?")) return;
    try {
      const res = await api.apiDelete(`/admin/batches/${id}`);
      if (!res.ok) {
        alert(res.error?.message || "Failed to delete batch");
        return;
      }
      await fetchAll();
    } catch (err: any) {
      alert(err.message || "Error deleting batch");
    }
  };

  // Assign faculty
  const handleAssignFaculty = async () => {
    setAssignMessage(null);
    if (!selectedBatchId || !selectedFacultyId) {
      setAssignMessage("Select a batch and a faculty.");
      return;
    }
    setAssignLoading(true);
    try {
      const res = await api.apiPost(
        `/admin/batches/${selectedBatchId}/assign-faculty/${selectedFacultyId}`,
        {}
      );
      setAssignLoading(false);
      if (!res.ok) {
        setAssignMessage(res.error?.message || "Failed to assign faculty");
        return;
      }
      setAssignMessage("Faculty assigned successfully.");
      await fetchAll();
    } catch (err: any) {
      setAssignLoading(false);
      setAssignMessage(err.message || "Failed to assign faculty");
    }
  };

  // Assign student
  const handleAssignStudent = async () => {
    setAssignMessage(null);
    if (!selectedBatchId || !selectedStudentId) {
      setAssignMessage("Select a batch and a student.");
      return;
    }
    setAssignLoading(true);
    try {
      const res = await api.apiPost(
        `/admin/batches/${selectedBatchId}/assign-student/${selectedStudentId}`,
        {}
      );
      setAssignLoading(false);
      if (!res.ok) {
        setAssignMessage(res.error?.message || "Failed to assign student");
        return;
      }
      setAssignMessage("Student assigned successfully.");
      await fetchAll();
    } catch (err: any) {
      setAssignLoading(false);
      setAssignMessage(err.message || "Failed to assign student");
    }
  };

  // ---------- NEW: open student list dialog for a batch ----------
  const openStudentsDialog = async (batchId: string) => {
    setStudentsDialogError(null);
    setStudentsDialogLoading(true);
    setCurrentDialogBatchId(batchId);
    setIsStudentDialogOpen(true);

    try {
      // Try to fetch batch detail if server provides a detail endpoint
      // (some servers expose GET /admin/batches/:id). We attempt that first.
      const detailRes = await api.apiGet(`/admin/batches/${batchId}`);
      if (detailRes.ok && detailRes.data) {
        // server might return either object or array
        const batchObj = Array.isArray(detailRes.data) ? detailRes.data[0] : detailRes.data;
        const studentsRaw = batchObj?.students ?? [];
        const normalized = studentsRaw.map((s: any) => {
          // If server gives student objects
          if (s && typeof s === "object") {
            return { id: s._id || s.id, name: s.name || String(s), systemId: s.systemId || s.system_id || "" };
          }
          // If server gives strings (names), keep name only
          return { name: String(s), systemId: "" };
        });
        setStudentListForDialog(normalized);
        setStudentsDialogLoading(false);
        return;
      }
    } catch (err) {
      // ignore — we'll fallback to using existing fetched batches data
    }

    // Fallback: use local `batches` state (may contain strings or objects)
    const local = batches.find((b) => String(b._id) === String(batchId));
    if (!local) {
      setStudentListForDialog([]);
      setStudentsDialogError("Unable to load student list.");
      setStudentsDialogLoading(false);
      return;
    }

    const studentsRaw = local.students || [];
    const normalized = (studentsRaw as any[]).map((s) => {
      if (s && typeof s === "object") {
        return { id: s._id || s.id, name: s.name || String(s), systemId: s.systemId || "" };
      }
      return { name: String(s), systemId: "" };
    });
    setStudentListForDialog(normalized);
    setStudentsDialogLoading(false);
  };

  // ---------- NEW: unassign student from batch ----------
  const handleUnassignStudent = async (studentId?: string) => {
    if (!currentDialogBatchId) return;
    if (!studentId) {
      alert("Student id not available for this record. Cannot unassign.");
      return;
    }
    if (!confirm("Remove this student from the batch? The student will become unassigned.")) return;

    try {
      const res = await api.apiDelete(
        `/admin/batches/${currentDialogBatchId}/unassign-student/${studentId}`
      );
      if (!res.ok) {
        alert(res.error?.message || "Failed to unassign student");
        return;
      }
      // update dialog list from returned batch if provided
      if (res.data?.batch) {
        const updatedStudents = (res.data.batch.students || []).map((s: any) => ({
          id: s._id || s.id,
          name: s.name || String(s),
          systemId: s.systemId || "",
        }));
        setStudentListForDialog(updatedStudents);
      } else {
        // otherwise, remove the student locally from dialog list
        setStudentListForDialog(prev => prev.filter(s => s.id !== studentId));
      }
      // refresh main table to reflect change
      await fetchAll();
    } catch (err: any) {
      alert(err.message || "Error unassigning student");
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Batch Management</h2>

        <div className="flex items-center gap-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="default" className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Batch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Batch</DialogTitle>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Batch Name"
                />
                <Input
                  value={newProgram}
                  onChange={(e) => setNewProgram(e.target.value)}
                  placeholder="Program"
                />
                <Input
                  value={newYear ?? ""}
                  onChange={(e) =>
                    setNewYear(e.target.value ? Number(e.target.value) : "")
                  }
                  placeholder="Year"
                />
                <Input
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  placeholder="Section"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateBatch}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ASSIGN UI */}
      <Card className="p-4 space-y-4">
        {/* Faculty */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-sm block mb-1">Select Batch</label>
            <select
              className="w-full px-3 py-2 border rounded"
              value={selectedBatchId ?? ""}
              onChange={(e) => setSelectedBatchId(e.target.value || null)}
            >
              <option value="">-- Select batch --</option>
              {batches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm block mb-1">Select Faculty</label>
            <select
              className="w-full px-3 py-2 border rounded"
              value={selectedFacultyId ?? ""}
              onChange={(e) => setSelectedFacultyId(e.target.value || null)}
            >
              <option value="">-- Select faculty --</option>
              {facultyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.systemId} - {f.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={handleAssignFaculty}
            disabled={assignLoading || !selectedBatchId || !selectedFacultyId}
          >
            <UserPlus className="w-4 h-4 mr-2" /> Assign Faculty
          </Button>
        </div>

        {/* Student */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-sm block mb-1">Select Batch</label>
            <select
              className="w-full px-3 py-2 border rounded"
              value={selectedBatchId ?? ""}
              onChange={(e) => setSelectedBatchId(e.target.value || null)}
            >
              <option value="">-- Select batch --</option>
              {batches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm block mb-1">Select Student</label>
            <select
              className="w-full px-3 py-2 border rounded"
              value={selectedStudentId ?? ""}
              onChange={(e) => setSelectedStudentId(e.target.value || null)}
            >
              <option value="">-- Select student --</option>
              {studentOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.systemId} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={handleAssignStudent}
            disabled={assignLoading || !selectedBatchId || !selectedStudentId}
          >
            Assign Student
          </Button>
        </div>

        {assignMessage && (
          <div className="text-sm text-green-700">{assignMessage}</div>
        )}
      </Card>

      {/* ========== TABLE FOR EXISTING BATCHES ========== */}
      <Card className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-3 text-left text-sm font-semibold">Name</th>
              <th className="p-3 text-left text-sm font-semibold">Program</th>
              <th className="p-3 text-left text-sm font-semibold">Year</th>
              <th className="p-3 text-left text-sm font-semibold">Section</th>
              <th className="p-3 text-left text-sm font-semibold">Faculty</th>
              <th className="p-3 text-left text-sm font-semibold">Students</th>
              <th className="p-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : batches.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center">
                  No batches found.
                </td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr
                  key={b._id}
                  className="border-b hover:bg-gray-50 transition-colors"
                >
                  <td className="p-3 text-sm">{b.name}</td>
                  <td className="p-3 text-sm">{b.program || "—"}</td>
                  <td className="p-3 text-sm">{b.year || "—"}</td>
                  <td className="p-3 text-sm">{b.section || "—"}</td>
                  <td className="p-3 text-sm">
                    {b.faculty?.length ? b.faculty.join(", ") : "—"}
                  </td>
                  <td className="p-3 text-sm items-center gap-2">
                    <span>{b.students?.length ? `${b.students.length}` : 0}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openStudentsDialog(b._id)}
                      title="View students"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </td>
                  <td className="p-3 text-sm flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditBatch(b);
                        setIsEditOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteBatch(b._id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* STUDENTS DIALOG */}
      <Dialog open={isStudentDialogOpen} onOpenChange={setIsStudentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Students</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {studentsDialogLoading ? (
              <div className="text-sm">Loading students...</div>
            ) : studentsDialogError ? (
              <div className="text-sm text-red-600">{studentsDialogError}</div>
            ) : studentListForDialog.length === 0 ? (
              <div className="text-sm">No students in this batch.</div>
            ) : (
              <div className="space-y-2">
                {studentListForDialog.map((s) => (
                  <div key={s.id ?? s.name} className="flex items-center justify-between border rounded p-2">
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.systemId || "—"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        if (!s.id) {
                          alert('This student record does not contain an id; cannot remove from batch. Use assign/unassign from admin panel.');
                          return;
                        }
                        handleUnassignStudent(s.id);
                      }}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStudentDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
          </DialogHeader>
          {editBatch && (
            <div className="space-y-3 py-2">
              <Input
                value={editBatch.name}
                onChange={(e) =>
                  setEditBatch({ ...editBatch, name: e.target.value })
                }
                placeholder="Batch Name"
              />
              <Input
                value={editBatch.program || ""}
                onChange={(e) =>
                  setEditBatch({ ...editBatch, program: e.target.value })
                }
                placeholder="Program"
              />
              <Input
                value={editBatch.year ?? ""}
                onChange={(e) =>
                  setEditBatch({
                    ...editBatch,
                    year: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="Year"
              />
              <Input
                value={editBatch.section || ""}
                onChange={(e) =>
                  setEditBatch({ ...editBatch, section: e.target.value })
                }
                placeholder="Section"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditBatch}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
