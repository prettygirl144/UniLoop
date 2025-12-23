import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function HealthCheck() {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [dbTestStatus, setDbTestStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runHealthCheck = async () => {
    setLoading(true);
    console.log("🏥 Running health check verification...");
    
    try {
      // Test basic health endpoint
      const healthResponse = await fetch("/api/health");
      const healthData = await healthResponse.json();
      setHealthStatus(healthData);
      console.log("✅ Health check result:", healthData);

      // Test database write/read
      const dbTestResponse = await fetch("/api/db-test", { method: "POST" });
      const dbTestData = await dbTestResponse.json();
      setDbTestStatus(dbTestData);
      console.log("✅ Database test result:", dbTestData);

    } catch (error) {
      console.error("❌ Health check failed:", error);
      setHealthStatus({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🏥 System Health Check
          <Badge variant="outline">v1.0.1</Badge>
        </CardTitle>
        <CardDescription>
          Verify code execution and database persistence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runHealthCheck} 
          disabled={loading}
          data-testid="button-health-check"
        >
          {loading ? "Running Tests..." : "🧪 Run Verification Tests"}
        </Button>
        
        {healthStatus && (
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <h3 className="font-medium mb-2">💊 Database Health</h3>
            <div className="text-sm space-y-1">
              <div>Status: <Badge variant={healthStatus.ok ? "default" : "destructive"}>{healthStatus.ok ? "✅ Connected" : "❌ Failed"}</Badge></div>
              {healthStatus.requestId && <div>Request ID: <code className="text-xs">{healthStatus.requestId}</code></div>}
              {healthStatus.responseTime && <div>Response Time: {healthStatus.responseTime}</div>}
              {healthStatus.timestamp && <div>Timestamp: {new Date(healthStatus.timestamp).toLocaleTimeString()}</div>}
            </div>
          </div>
        )}

        {dbTestStatus && (
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
            <h3 className="font-medium mb-2">🧪 Database Write Test</h3>
            <div className="text-sm space-y-1">
              <div>Write Test: <Badge variant={dbTestStatus.ok ? "default" : "destructive"}>{dbTestStatus.writeTest}</Badge></div>
              <div>Read Test: <Badge variant={dbTestStatus.ok ? "default" : "destructive"}>{dbTestStatus.readTest}</Badge></div>
              {dbTestStatus.requestId && <div>Request ID: <code className="text-xs">{dbTestStatus.requestId}</code></div>}
              {dbTestStatus.responseTime && <div>Response Time: {dbTestStatus.responseTime}</div>}
              {dbTestStatus.insertedRecord && (
                <div>Inserted Record ID: {dbTestStatus.insertedRecord.id}</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}