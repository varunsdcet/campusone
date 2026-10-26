import { Router, type Request } from "express";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import {
  bbbConfig,
  createMeeting,
  endMeeting,
  joinMeetingUrl,
  listRecordings,
  meetingInfo,
} from "../../lib/bigBlueButton.js";
import { jitsiMeetUrl } from "../../lib/jitsiMeet.js";
import { webPublicUrl } from "../../lib/liveClass.js";
import { isFacultyAssigned } from "../instructor/sectionFaculty.js";
import { applyAutomaticAttendance, livePresenceCount, recordLiveJoin } from "./liveAttendance.js";

export const liveRouter: Router = Router();

type LiveRole = "moderator" | "viewer";
type LiveProvider = "bigbluebutton" | "jitsi";

function httpError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

async function resolveRoom(user: SessionClaims, sectionId: string) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, institutionId: user.institutionId },
    include: { course: true, term: true },
  });
  if (!section) throw httpError("Class not found", "NOT_FOUND", 404);

  let role: LiveRole | null = null;
  let completed = false;
  let studentId: string | null = null;
  if (await isFacultyAssigned(user, section)) role = "moderator";
  else if (user.roles.includes("admin") || user.roles.includes("registrar")) role = "moderator";
  else {
    const enrolled = await prisma.enrolment.findFirst({
      where: {
        institutionId: user.institutionId,
        sectionId: section.id,
        status: { in: ["enrolled", "completed"] },
        student: { personId: user.personId },
      },
      select: { id: true, status: true, studentId: true },
      orderBy: { status: "desc" },
    });
    if (enrolled) {
      role = "viewer";
      completed = enrolled.status !== "enrolled";
      studentId = enrolled.studentId;
    }
  }
  if (!role) throw httpError("You are not part of this class", "FORBIDDEN", 403);
  if (role === "viewer" && user.accountStatus === "paused") {
    throw httpError("Your account is paused. Resolve the compliance notice to rejoin classes.", "ACCOUNT_PAUSED", 403);
  }

  const person = await prisma.person.findFirst({
    where: { id: user.personId, institutionId: user.institutionId },
    select: { givenName: true, familyName: true },
  });
  const fullName = person ? `${person.givenName} ${person.familyName}`.trim() : "Participant";
  return {
    section,
    role,
    completed,
    fullName,
    studentId,
    meetingId: `heritage-${section.id}`,
    meetingName: `${section.course.code} ${section.code} — ${section.course.title}`,
  };
}

function requestedProvider(req: Request): LiveProvider | null {
  const value = typeof req.query.provider === "string" ? req.query.provider.toLowerCase() : "";
  return value === "bigbluebutton" || value === "jitsi" ? value : null;
}

function resolveProvider(req: Request) {
  const requested = requestedProvider(req);
  const cfg = bbbConfig();
  // A configured institutional BBB server is authoritative. This also upgrades
  // older saved /live links that explicitly requested Jitsi before BBB existed.
  if (cfg) return { provider: "bigbluebutton" as const, cfg };
  if (requested === "bigbluebutton") {
    throw httpError(
      "BigBlueButton is not configured. Choose Jitsi Meet, or ask an administrator to configure BBB_URL and BBB_SECRET.",
      "BBB_NOT_CONFIGURED",
      409,
    );
  }
  return { provider: "jitsi" as const, cfg: null };
}

function logoutUrl(req: Request, sectionId: string, provider: LiveProvider) {
  const path = `/live/${sectionId}?provider=${provider}&left=1`;
  const origin = req.header("origin");
  if (origin) {
    try {
      const host = new URL(origin).hostname;
      if (host === "localhost" || host === "127.0.0.1") return `${origin}${path}`;
    } catch {
      // Fall through to the configured public URL.
    }
  }
  return webPublicUrl(path);
}

liveRouter.get("/config", requireAuth, (_req, res) => {
  const bbbAvailable = Boolean(bbbConfig());
  res.json({
    provider: bbbAvailable ? "bigbluebutton" : "jitsi",
    providers: { jitsi: !bbbAvailable, bigbluebutton: bbbAvailable },
  });
});

liveRouter.get("/sections/:sectionId", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const room = await resolveRoom(user, String(req.params.sectionId));
    const { provider, cfg } = resolveProvider(req);
    const info = provider === "bigbluebutton" && cfg ? await meetingInfo(cfg, room.meetingId) : null;
    await applyAutomaticAttendance(user.institutionId, room.section);
    const totalEnrolled = await prisma.enrolment.count({
      where: { institutionId: user.institutionId, sectionId: room.section.id, status: "enrolled" },
    });
    const currentlyAttending =
      provider === "bigbluebutton" && info
        ? Math.max(0, info.participantCount - info.moderatorCount)
        : await livePresenceCount(user.institutionId, room.section.id);
    res.json({
      provider,
      sectionId: room.section.id,
      meetingName: room.meetingName,
      courseCode: room.section.course.code,
      sectionCode: room.section.code,
      role: room.role,
      canJoin: !room.completed,
      running: info?.running ?? null,
      participantCount: info?.participantCount ?? null,
      totalEnrolled,
      currentlyAttending,
      recording: info?.recording ?? null,
      startedAt: info?.startTime ? new Date(info.startTime).toISOString() : null,
    });
  } catch (err) {
    next(err);
  }
});

liveRouter.post("/sections/:sectionId/join", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const room = await resolveRoom(user, String(req.params.sectionId));
    if (room.completed) {
      throw httpError("You have completed this course, so its live class is closed. Published recordings are still available.", "COURSE_COMPLETED", 403);
    }
    const { provider, cfg } = resolveProvider(req);
    if (provider === "jitsi") {
      if (room.role === "viewer" && room.studentId) {
        await recordLiveJoin(user, { sectionId: room.section.id, studentId: room.studentId, provider });
      }
      res.json({
        status: "ready",
        provider: "jitsi",
        role: room.role,
        meetingName: room.meetingName,
        url: jitsiMeetUrl(room.section.course.code, room.section.code, room.section.id),
      });
      return;
    }
    if (!cfg) throw httpError("BigBlueButton is not configured", "BBB_NOT_CONFIGURED", 409);
    if (room.role === "moderator") {
      await createMeeting(cfg, {
        meetingId: room.meetingId,
        name: room.meetingName,
        welcome: `Welcome to <b>${room.meetingName}</b>.`,
        logoutUrl: logoutUrl(req, room.section.id, provider),
        context: room.section.term?.name ?? undefined,
      });
    } else {
      const info = await meetingInfo(cfg, room.meetingId);
      if (!info.running) {
        res.json({ status: "waiting", provider: "bigbluebutton", role: room.role, meetingName: room.meetingName });
        return;
      }
    }
    if (room.role === "viewer" && room.studentId) {
      await recordLiveJoin(user, { sectionId: room.section.id, studentId: room.studentId, provider });
    }
    res.json({
      status: "ready",
      provider: "bigbluebutton",
      role: room.role,
      meetingName: room.meetingName,
      url: joinMeetingUrl(cfg, {
        meetingId: room.meetingId,
        fullName: room.fullName,
        role: room.role === "moderator" ? "MODERATOR" : "VIEWER",
        userId: user.accountId,
      }),
    });
  } catch (err) {
    next(err);
  }
});

liveRouter.post("/sections/:sectionId/presence", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const room = await resolveRoom(user, String(req.params.sectionId));
    const { provider } = resolveProvider(req);
    if (room.role !== "viewer" || !room.studentId || room.completed) {
      throw httpError("Only an active enrolled student can report live attendance", "FORBIDDEN", 403);
    }
    await recordLiveJoin(user, { sectionId: room.section.id, studentId: room.studentId, provider });
    await applyAutomaticAttendance(user.institutionId, room.section);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

liveRouter.post("/sections/:sectionId/end", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const room = await resolveRoom(user, String(req.params.sectionId));
    if (room.role !== "moderator") throw httpError("Only the instructor can end the class", "FORBIDDEN", 403);
    const { provider, cfg } = resolveProvider(req);
    if (provider !== "bigbluebutton" || !cfg) {
      throw httpError("Jitsi rooms close when everyone leaves", "JITSI_NO_END_ACTION", 409);
    }
    const ended = await endMeeting(cfg, room.meetingId);
    res.json({ ended });
  } catch (err) {
    next(err);
  }
});

liveRouter.get("/sections/:sectionId/recordings", requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const room = await resolveRoom(user, String(req.params.sectionId));
    const { provider, cfg } = resolveProvider(req);
    if (provider === "jitsi") {
      res.json({ provider: "jitsi", recordings: [] });
      return;
    }
    if (!cfg) throw httpError("BigBlueButton is not configured", "BBB_NOT_CONFIGURED", 409);
    const recordings = await listRecordings(cfg, room.meetingId);
    res.json({
      provider: "bigbluebutton",
      recordings: room.role === "moderator" ? recordings : recordings.filter((r) => r.published),
    });
  } catch (err) {
    next(err);
  }
});
