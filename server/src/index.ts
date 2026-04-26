import "dotenv/config";
import express from "express";
import cors from "cors";
import { errorHandler, notFound } from "./middleware/error";
import { usersRouter } from "./routes/users";
import { fcfsRouter } from "./routes/fcfs";
import { tasksRouter } from "./routes/tasks";
import { applicationsRouter } from "./routes/applications";
import { referralsRouter } from "./routes/referrals";
import { eligibilityRouter } from "./routes/eligibility";
import { adminRouter } from "./routes/admin";
import { signatureRouter } from "./routes/signature";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/users", usersRouter);
app.use("/api/fcfs", fcfsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/applications", applicationsRouter);
app.use("/api/referrals", referralsRouter);
app.use("/api/eligibility", eligibilityRouter);
app.use("/api/admin", adminRouter);
app.use("/api/signature", signatureRouter);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`[simian-server] listening on http://localhost:${port}`);
});
