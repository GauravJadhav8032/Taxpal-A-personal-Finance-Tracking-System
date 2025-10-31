// ---------- 1) Load .env BEFORE anything else ----------
import path from "path";
import fs from "fs";
import * as dotenv from "dotenv";

// Load .env from common locations
const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env"),
];

let loaded = false;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.log("[env] loaded:", p);
    loaded = true;
    break;
  }
}
if (!loaded) console.warn("[env] .env not found; tried:", candidates);

// ---------- 2) Imports that rely on env ----------

// (removed static imports of express, cors, mongoose, swagger and mailer)

// ---------- 3..12) App bootstrap (dynamic imports + guarded startup) ----------
let app: any = null;
const PORT = Number(process.env.PORT || 5000);

async function loadAndStart() {
  try {
    const [
      expressModule,
      corsModule,
      mongooseModule,
      swaggerModule,
      mailerModule,
    ] = await Promise.all([
      import("express"),
      import("cors"),
      import("mongoose"),
      import("./swagger"),
      import("./utils/mailer"),
    ]);

    const express = expressModule.default ?? expressModule;
    const cors = corsModule.default ?? corsModule;
    const mongoose = mongooseModule.default ?? mongooseModule;
    const { setupSwagger } = swaggerModule;
    const { verifyMailer } = mailerModule;

    // ---------- 3) Initialize App ----------
    app = express();

    // ---------- 4) CORS ----------
    const corsOrigins =
      process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) || [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
      ];
    app.use(cors({ origin: corsOrigins, credentials: true }));

    // ---------- 5) Core Middleware ----------
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.disable("x-powered-by");

    // ---------- 6) Setup Swagger ----------
    setupSwagger(app);
    console.log(`📘 Swagger UI running at: http://localhost:${PORT}/api-docs`);

    // ---------- 7) Database Connection ----------
    const mongoUri =
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      "mongodb://localhost:27017/taxpal";

    console.log("[db] Connecting to:", mongoUri);
    mongoose
      .connect(mongoUri)
      .then(() => console.log("[db] ✅ Connected to MongoDB"))
      .catch((err: any) => console.error("[db] ❌ Connection error:", err));

    // ---------- 8) Import All Routes ----------
    const authRoutes = (await import("./api/auth/auth.routes")).default;
    const incomeRoutes = (await import("./api/income/income.routes")).default;
    const expenseRoutes = (await import("./api/expense/expense.routes")).default;
    const dashboardRoutes = (await import("./api/dashboard/dashboard-routes")).default;
    const budgetsRoutes = (await import("./api/budget/budget.routes")).default;
    const transactionRoutes = (await import("./api/transaction/transaction.routes")).default;
    const categoriesRoutes = (await import("./api/Categories/category.routes")).default;
    const taxRoutes = (await import("./api/TaxEstimator/TaxEstimator.routes")).default;
    const financialReportsRoutes = (await import("./api/FinancialReport/FinancialReport.routes")).default;
    const exportRoutes = (await import("./api/ExportDownload/ExportDownload.routes")).default;

    // ---------- 9) Mount Routes ----------
    app.use("/api/v1/auth", authRoutes);
    app.use("/api/v1/incomes", incomeRoutes);
    app.use("/api/v1/expenses", expenseRoutes);
    app.use("/api/v1/dashboard", dashboardRoutes);
    app.use("/api/v1/budgets", budgetsRoutes);
    app.use("/api/v1/transactions", transactionRoutes);
    app.use("/api/v1/categories", categoriesRoutes);
    app.use("/api/v1/tax", taxRoutes);
    app.use("/api/v1/financial-reports", financialReportsRoutes);
    app.use("/api/v1/export", exportRoutes);

    // ---------- 10) Health Check ----------
    app.get("/api/v1/health", (_req: any, res: any) => {
      res.json({ status: "OK", message: "TaxPal API is running 🚀" });
    });

    // ---------- 11) Route Inspector (DEV ONLY) ----------
    app.get("/__routes", (_req: any, res: any) => {
      const stack: any[] = (app as any)._router?.stack || [];
      const routes: string[] = [];

      stack.forEach((l: any) => {
        if (l.name === "router" && l.handle?.stack) {
          const prefix =
            l.regexp
              ?.toString()
              .replace(/^\/\^\\/, "/")
              .replace(/\\\/\?\(\?\=\/\|\$\)\/i$/, "") || "";
          l.handle.stack.forEach((s: any) => {
            if (s.route) {
              const methods = Object.keys(s.route.methods)
                .join(",")
                .toUpperCase();
              routes.push(`${methods} ${prefix}${s.route.path}`);
            }
          });
        } else if (l.route && l.route.path) {
          const methods = Object.keys(l.route.methods).join(",").toUpperCase();
          routes.push(`${methods} ${l.route.path}`);
        }
      });

      res.json({ routes });
    });

    // ---------- 12) Start Server ----------
    if (!(global as any).__taxpal_server_started) {
      const server = app.listen(PORT, () => {
        (global as any).__taxpal_server_started = true;
        console.log(`🚀 TaxPal server running at http://localhost:${PORT}`);
        try {
          verifyMailer();
        } catch (e) {
          console.warn("[mailer] verify skipped/failed:", (e as Error)?.message);
        }
      });

      const shutdown = () => server.close(() => process.exit(0));
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    } else {
      console.log("[server] listen skipped (already started)");
    }
  } catch (err: any) {
    console.error("[startup] Failed to load runtime dependencies:", err?.message || err);
    console.error("To fix, run (from project root):");
    console.error("  npm install --prefix server");
    console.error("or:");
    console.error("  cd server && npm install");
    process.exit(1);
  }
}

loadAndStart();

// ---------- Export app (may be null until loaded) ----------
export default app;
