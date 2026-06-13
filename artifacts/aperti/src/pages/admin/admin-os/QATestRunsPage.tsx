import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { History, CheckCircle, XCircle, SkipForward, Cpu, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const api = (path: string) =>
  fetch(path, { credentials: "include", headers: { "Content-Type": "application/json" } });

function MiniBar({ passed, failed, skipped, total }: { passed: number; failed: number; skipped: number; total: number }) {
  if (total === 0) return <div className="h-2 bg-gray-100 rounded-full w-full" />;
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex w-full">
      <div className="bg-green-500 h-full" style={{ width: `${(passed / total) * 100}%` }} />
      <div className="bg-red-400 h-full" style={{ width: `${(failed / total) * 100}%` }} />
      <div className="bg-yellow-300 h-full" style={{ width: `${(skipped / total) * 100}%` }} />
    </div>
  );
}

export default function QATestRunsPage() {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["admin-test-runs"],
    queryFn: () => api("/api/admin/test-runs").then(r => r.json()),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-6 h-6 text-teal-600" /> Test Run History
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">View past test execution results</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /> Passed</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /> Failed</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-300" /> Skipped</div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-sm text-gray-400">Loading test runs…</div>
      ) : runs.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-sm text-gray-400">
            No test runs yet. Run sanity tests or create a test run from the Test Cases page.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {runs.map((run: any, i: number) => {
            const passRate = run.totalTests > 0 ? Math.round((run.passed / run.totalTests) * 100) : 0;
            return (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{run.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                          {run.triggeredBy === "automated"
                            ? <Cpu className="w-3 h-3" />
                            : <User className="w-3 h-3" />}
                          <span className="capitalize">{run.triggeredBy}</span>
                          <span>·</span>
                          <span>{new Date(run.executedAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <Badge className={
                        passRate >= 90 ? "bg-green-100 text-green-800 border-green-200 border" :
                        passRate >= 70 ? "bg-yellow-100 text-yellow-800 border-yellow-200 border" :
                        "bg-red-100 text-red-800 border-red-200 border"
                      }>
                        {passRate}% pass
                      </Badge>
                    </div>

                    <MiniBar passed={run.passed} failed={run.failed} skipped={run.skipped} total={run.totalTests} />

                    <div className="flex items-center gap-4 mt-3 text-xs">
                      <div className="flex items-center gap-1 text-gray-600">
                        <span className="font-semibold text-gray-900">{run.totalTests}</span> total
                      </div>
                      <div className="flex items-center gap-1 text-green-700">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="font-medium">{run.passed}</span> passed
                      </div>
                      <div className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-3.5 h-3.5" />
                        <span className="font-medium">{run.failed}</span> failed
                      </div>
                      {run.skipped > 0 && (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <SkipForward className="w-3.5 h-3.5" />
                          <span className="font-medium">{run.skipped}</span> skipped
                        </div>
                      )}
                      {run.coveragePercentage && (
                        <div className="ml-auto text-gray-400">
                          {Number(run.coveragePercentage).toFixed(1)}% coverage
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
