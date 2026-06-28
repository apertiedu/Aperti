import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CertResult {
  valid: boolean;
  certificate?: {
    studentName: string;
    title: string;
    issuedAt: string;
    issuerName?: string;
    subject?: string;
  };
  error?: string;
}

export default function CertificateVerify() {
  const [, params] = useRoute("/verify/:code");
  const code = params?.code ?? "";
  const [result, setResult] = useState<CertResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/certificates/verify/${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data) => setResult(data))
      .catch(() => setResult({ valid: false, error: "Unable to reach verification server." }))
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900 mb-2">
            <Award className="h-7 w-7 text-teal-600" />
            Aperti.
          </div>
          <p className="text-gray-500 text-sm">Certificate Verification</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-base text-gray-500 font-normal">
              Verification code: <span className="font-mono font-semibold text-gray-800">{code || "—"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex flex-col items-center gap-4 py-10">
                <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
                <p className="text-gray-500 text-sm">Verifying certificate…</p>
              </div>
            ) : result?.valid ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-green-600" />
                </div>
                <Badge variant="default" className="bg-green-600 text-white px-3 py-1">
                  Valid Certificate
                </Badge>
                <div className="space-y-1 text-center">
                  <p className="text-xl font-bold text-gray-900">{result.certificate?.studentName}</p>
                  <p className="text-gray-600 font-medium">{result.certificate?.title}</p>
                  {result.certificate?.subject && (
                    <p className="text-sm text-gray-500">{result.certificate.subject}</p>
                  )}
                  <p className="text-sm text-gray-400 mt-2">
                    Issued {result.certificate?.issuedAt ? new Date(result.certificate.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""}
                    {result.certificate?.issuerName ? ` by ${result.certificate.issuerName}` : ""}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  This certificate was issued through the Aperti educational platform and has been verified as authentic.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-9 w-9 text-red-500" />
                </div>
                <Badge variant="destructive" className="px-3 py-1">
                  Invalid Certificate
                </Badge>
                <p className="text-gray-600 text-sm">
                  {result?.error === "Certificate not found"
                    ? "No certificate was found with this code. It may have been revoked or the code may be incorrect."
                    : result?.error ?? "This certificate could not be verified."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by <span className="font-semibold">Aperti</span> · Educational Operating System
        </p>
      </motion.div>
    </div>
  );
}
