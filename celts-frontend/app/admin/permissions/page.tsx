"use client";

import { useState, useEffect } from "react";
import { Lock, Loader2 } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { navItems } from "@/components/admin/NavItems";
import api from "@/lib/api";

const staticPermissions = [
  {
    name: "View Dashboard",
    key: "view_dashboard",
    admin: true,
    faculty: true,
    student: true,
  },
  {
    name: "Manage Users",
    key: "manage_users",
    admin: true,
    faculty: false,
    student: false,
  },
  {
    name: "Create Tests",
    key: "create_tests",
    admin: false,
    faculty: true,
    student: false,
  },
  {
    name: "View Results",
    key: "view_results",
    admin: true,
    faculty: true,
    student: true,
  },
  {
    name: "View Analytics",
    key: "view_analytics",
    admin: true,
    faculty: true,
    student: false,
  },
];

interface FacultyUser {
  _id: string;
  name: string;
  email: string;
  systemId?: string;
  facultyPermissions?: {
    canEditScores?: boolean;
  };
}

export default function PermissionsPage() {
  const [userName, setUserName] = useState<string>("");
  const [facultyList, setFacultyList] = useState<FacultyUser[]>([]);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load logged-in admin name
  useEffect(() => {
    const storedUser = localStorage.getItem("celts_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserName(parsed.name || "");
      } catch (err) {
        console.error("Error parsing user from storage:", err);
      }
    }
  }, []);

  // Fetch faculty list + permissions
  async function fetchFaculty() {
    setLoadingFaculty(true);
    setError(null);
    try {
      const res = await api.apiGet("/admin/users?role=faculty");
      if (!res.ok) {
        setError(res.error?.message || "Failed to load faculty list");
        setFacultyList([]);
        setLoadingFaculty(false);
        return;
      }
      const data: FacultyUser[] = res.data ?? [];
      setFacultyList(data);
    } catch (err: any) {
      console.error("[PermissionsPage] fetchFaculty error:", err);
      setError(err?.message || "Network error");
      setFacultyList([]);
    } finally {
      setLoadingFaculty(false);
    }
  }

  useEffect(() => {
    fetchFaculty();
  }, []);

  async function handleToggleEditScores(
    facultyId: string,
    nextValue: boolean
  ) {
    try {
      setSavingId(facultyId);
      setError(null);

      const res = await api.apiPatch(
        `/admin/faculty/${facultyId}/permissions`,
        { canEditScores: nextValue }
      );

      if (!res.ok) {
        setError(res.error?.message || "Failed to update permission");
        return;
      }

      // Update local state
      setFacultyList((prev) =>
        prev.map((f) =>
          f._id === facultyId
            ? {
                ...f,
                facultyPermissions: {
                  ...(f.facultyPermissions || {}),
                  canEditScores: nextValue,
                },
              }
            : f
        )
      );
    } catch (err: any) {
      console.error("[PermissionsPage] toggle error:", err);
      setError(err?.message || "Network error while updating permission");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Admin" userName={userName}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Role Permissions</h1>
          <p className="text-muted-foreground">
            View the default capabilities for each role and control whether
            faculty can edit student band scores.
          </p>
        </div>

        {/* Static role matrix (documentation) */}
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Permission
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">
                    Admin
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">
                    Faculty
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">
                    Student
                  </th>
                </tr>
              </thead>
              <tbody>
                {staticPermissions.map((perm) => (
                  <tr
                    key={perm.key}
                    className="border-b border-border hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      {perm.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={perm.admin} disabled />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={perm.faculty} disabled />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={perm.student} disabled />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Permission Notes
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Admin: Full system access and user management</li>
              <li>• Faculty: Can create tests, grade submissions, and (optionally) edit scores</li>
              <li>• Student: Can take tests and view personal results</li>
            </ul>
          </div>
        </Card>

        {/* Dynamic: Faculty score-edit permission */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <h2 className="text-lg font-semibold">
                Faculty Score Editing Permission
              </h2>
              <p className="text-sm text-muted-foreground">
                Allow or revoke the ability for each faculty member to edit
                student band scores.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchFaculty}
              className="inline-flex items-center text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted"
              disabled={loadingFaculty}
            >
              {loadingFaculty && (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              )}
              Refresh
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600 mb-1">{error}</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-semibold">
                    Faculty
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Email
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Employee ID
                  </th>
                  <th className="px-3 py-2 text-center font-semibold">
                    Can Edit Band Scores
                  </th>
                </tr>
              </thead>
              <tbody>
                {facultyList.length === 0 && !loadingFaculty && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-xs text-muted-foreground"
                    >
                      No faculty users found.
                    </td>
                  </tr>
                )}

                {facultyList.map((fac) => {
                  const canEdit =
                    fac.facultyPermissions?.canEditScores === true;
                  const isSaving = savingId === fac._id;

                  return (
                    <tr
                      key={fac._id}
                      className="border-b border-border hover:bg-muted/40"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">
                          {fac.name || "Unnamed Faculty"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {fac.email}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {fac.systemId || "-"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex items-center gap-2">
                          <Checkbox
                            checked={canEdit}
                            disabled={isSaving}
                            onCheckedChange={(val) =>
                              handleToggleEditScores(
                                fac._id,
                                Boolean(val)
                              )
                            }
                          />
                          {isSaving && (
                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {loadingFaculty && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-xs text-muted-foreground"
                    >
                      <Loader2 className="w-4 h-4 mr-2 inline-block animate-spin" />
                      Loading faculty...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
