import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

// Health check endpoint that verifies database connectivity
router.get("/health", async (req, res) => {
  const startTime = Date.now();
  const requestId = `health_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`🏥 [HEALTH-CHECK] Starting health check - RequestID: ${requestId}`);
    
    // Test basic database connectivity with a simple query
    const result = await db.execute(sql`SELECT 1 as health_check, NOW() as current_time`);
    const responseTime = Date.now() - startTime;
    
    const healthData = {
      ok: true,
      database: "connected",
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId,
      version: "1.0.1",
      environment: process.env.NODE_ENV || "unknown"
    };
    
    console.log(`✅ [HEALTH-CHECK] Database connectivity verified - RequestID: ${requestId}, Response time: ${responseTime}ms`);
    
    res.status(200).json(healthData);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ [HEALTH-CHECK] Database health check failed - RequestID: ${requestId}:`, error);
    
    res.status(503).json({
      ok: false,
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId,
      version: "1.0.1",
      environment: process.env.NODE_ENV || "unknown"
    });
  }
});

// Database write test endpoint for verification
router.post("/db-test", async (req, res) => {
  const startTime = Date.now();
  const requestId = `dbtest_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`🧪 [DB-TEST] Starting database write test - RequestID: ${requestId}`);
    
    // Create a test table if it doesn't exist and insert a test record
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS health_tests (
        id SERIAL PRIMARY KEY,
        test_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        request_id TEXT
      )
    `);
    
    const testData = `Health test - ${new Date().toISOString()}`;
    const insertResult = await db.execute(sql`
      INSERT INTO health_tests (test_data, request_id) 
      VALUES (${testData}, ${requestId}) 
      RETURNING id, created_at
    `);
    
    // Verify we can read it back
    const readResult = await db.execute(sql`
      SELECT * FROM health_tests WHERE request_id = ${requestId}
    `);
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ [DB-TEST] Database write/read test successful - RequestID: ${requestId}, Response time: ${responseTime}ms`);
    
    res.status(200).json({
      ok: true,
      writeTest: "passed",
      readTest: "passed",
      insertedRecord: readResult.rows[0],
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId,
      version: "1.0.1"
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ [DB-TEST] Database write test failed - RequestID: ${requestId}:`, error);
    
    res.status(500).json({
      ok: false,
      writeTest: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      requestId,
      version: "1.0.1"
    });
  }
});

export default router;