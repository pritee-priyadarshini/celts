// components/admin/batch-management.tsx
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
import { Plus, UserPlus } from "lucide-react";

type Batch = {
  _id: string;
  name: string;
  program?: string;
  year?: number;
  section?: string;
  faculty?: string[]; // array of faculty ids or names (depends on backend)
  students?: string[]; // array of student ids or names (depends on backend)
  createdAt?: string;
};

type UserOption = { id: string; name: string; email?: string };

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
      const opts = (res.data || []).map((u: any) => ({ id: u._id || u.id, name: u.name }));
      setFacultyOptions(opts);
    } catch (err) {
      // ignore quietly
    }
  }

  async function fetchStudentOptions() {
    try {
      const res = await api.apiGet("/admin/users?role=student");
      if (!res.ok) return;
      const opts = (res.data || []).map((u: any) => ({ id: u._id || u.id, name: u.name }));
      setStudentOptions(opts);
    } catch (err) {
      // ignore quietly
    }
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

  // Assign faculty to batch
  const handleAssignFaculty = async () => {
    setAssignMessage(null);
    if (!selectedBatchId || !selectedFacultyId) {
      setAssignMessage("Select a batch and a faculty.");
      return;
    }
    setAssignLoading(true);
    try {
      const res = await api.apiPost(`/admin/batches/${selectedBatchId}/assign-faculty/${selectedFacultyId}`, {});
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

  // Assign student to batch
  const handleAssignStudent = async () => {
    setAssignMessage(null);
    if (!selectedBatchId || !selectedStudentId) {
      setAssignMessage("Select a batch and a student.");
      return;
    }
    setAssignLoading(true);
    try {
      const res = await api.apiPost(`/admin/batches/${selectedBatchId}/assign-student/${selectedStudentId}`, {});
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

  return (
    <div className="space-y-4">
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
                <div>
                  <label className="block text-sm mb-1">Batch Name</label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. MBA-1A" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Program (optional)</label>
                  <Input value={newProgram} onChange={(e) => setNewProgram(e.target.value)} placeholder="MBA / BTech" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Year (optional)</label>
                  <Input value={newYear ?? ""} onChange={(e) => setNewYear(e.target.value ? Number(e.target.value) : "")} placeholder="2025" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Section (optional)</label>
                  <Input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="A / B / C" />
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateBatch}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <div className="p-4 space-y-4">
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
                    {b.name}{b.section ? ` (${b.section})` : ""}
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
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAssignFaculty} disabled={assignLoading || !selectedBatchId || !selectedFacultyId}>
                <UserPlus className="w-4 h-4 mr-2" /> Assign Faculty
              </Button>
            </div>
          </div>

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
                    {b.name}{b.section ? ` (${b.section})` : ""}
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
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAssignStudent} disabled={assignLoading || !selectedBatchId || !selectedStudentId}>
                Assign Student
              </Button>
            </div>
          </div>

          {assignMessage && <div className="text-sm text-green-700">{assignMessage}</div>}

          <div>
            <h3 className="text-lg font-medium mb-2">Existing Batches</h3>
            {loading ? (
              <div>Loading...</div>
            ) : batches.length === 0 ? (
              <div>No batches created yet.</div>
            ) : (
              <div className="space-y-2">
                {batches.map((b) => (
                  <div key={b._id} className="p-3 border rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">
                          {b.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {b.program || ""} Section {b.section ? `- ${b.section}` : null} {b.year ? `• ${b.year}` : ""}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : ""}
                      </div>
                    </div>

                    <div className="mt-2 text-sm">
                      <strong>Faculty:</strong>{" "}
                      {Array.isArray(b.faculty) && b.faculty.length > 0 ? b.faculty.join(", ") : <em>None</em>}
                    </div>
                    <div className="mt-1 text-sm">
                      <strong>Students:</strong>{" "}
                      {Array.isArray(b.students) && b.students.length > 0 ? b.students.length : 0} student(s)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
