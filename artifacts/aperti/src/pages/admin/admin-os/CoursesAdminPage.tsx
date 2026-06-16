import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, BookOpen, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchJSON } from "@/lib/api";
import { toast } from "sonner";

const VISIBILITY_STYLES: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
  private: "bg-blue-100 text-blue-700",
};

export default function CoursesAdminPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-courses", search, page],
    queryFn: () => fetchJSON(`/api/admin/courses?search=${search}&page=${page}&limit=20`),
    placeholderData: (prev: any) => prev,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, visibility }: any) =>
      fetch(`/api/admin/courses/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-courses"] }); toast.success("Course updated"); },
    onError: () => toast.error("Update failed"),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/courses/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-courses"] }); toast.success("Course archived"); },
    onError: () => toast.error("Archive failed"),
  });

  const courses: any[] = (data as any)?.courses || [];
  const total: number = (data as any)?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Course Administration</h1>
        <p className="text-sm text-gray-500">{total.toLocaleString()} total courses</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search courses…" className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary bg-white" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Course", "Teacher", "Units", "Visibility", "Created", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array(5).fill(0).map((_,i)=><tr key={i}>{Array(6).fill(0).map((_,j)=><td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded animate-pulse" /></td>)}</tr>)
              ) : courses.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No courses found</td></tr>
              ) : courses.map((c: any) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 truncate max-w-40">{c.name}</p>
                        <p className="text-xs text-gray-400">#{c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-800">{c.teacher_name || "—"}</p>
                    <p className="text-xs text-gray-400">@{c.username}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.unit_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VISIBILITY_STYLES[c.visibility] || "bg-gray-100 text-gray-600"}`}>{c.visibility}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {c.visibility === "published" ? (
                        <button onClick={() => toggleMutation.mutate({ id: c.id, visibility: "draft" })} className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 border border-orange-200 rounded hover:bg-orange-50">
                          <EyeOff className="w-3 h-3" /> Unpublish
                        </button>
                      ) : (
                        <button onClick={() => toggleMutation.mutate({ id: c.id, visibility: "published" })} className="flex items-center gap-1 px-2 py-1 text-xs text-primary border border-primary/30 rounded hover:bg-primary/5">
                          <Eye className="w-3 h-3" /> Publish
                        </button>
                      )}
                      <button onClick={() => { if (confirm("Archive this course?")) archiveMutation.mutate(c.id); }} className="px-2 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50">Archive</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
