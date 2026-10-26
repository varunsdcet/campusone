import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClaims } from "@myheritage/contracts";

const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
  available: vi.fn(),
  completed: vi.fn(),
  scope: vi.fn(),
}));

vi.mock("@myheritage/db", () => ({ prisma: {} }));
vi.mock("../admin/heritage/workshops.js", () => ({
  attendanceDay: vi.fn(),
  availableWorkshops: mocks.available,
  completedWorkshops: mocks.completed,
  createEnrolment: vi.fn(),
  getWorkshop: vi.fn(),
  instructorWorkshopScope: mocks.scope,
  listEnrolments: vi.fn(),
  myWorkshops: mocks.mine,
  saveAttendance: vi.fn(),
  setEnrolmentStatus: vi.fn(),
  workshopCounts: vi.fn(),
}));

import { buildWorkshopList, parseWorkshopListKind } from "./workshopScreens.js";

const user: SessionClaims = {
  sub: "10000000-0000-4000-8000-000000000001",
  accountId: "10000000-0000-4000-8000-000000000002",
  personId: "10000000-0000-4000-8000-000000000003",
  institutionId: "10000000-0000-4000-8000-000000000004",
  roles: ["instructor"],
  sessionId: "10000000-0000-4000-8000-000000000005",
};

const workshop = (id: string, title: string) => ({
  id,
  code: id.toUpperCase(),
  title,
  category: "Professional Development",
  status: "Upcoming",
  startDate: "2026-11-10",
  endDate: "2026-11-10",
  continuous: false,
  schedule: "Tue 10:00–12:00",
  length: "2 hours",
  campus: "Surrey",
  classroom: "Room 101",
  seatsLeft: 8,
  capacity: 20,
});

beforeEach(() => {
  mocks.scope.mockReset().mockResolvedValue({ workshopIds: new Set(["mine", "available", "completed"]) });
  mocks.mine.mockReset().mockResolvedValue({ items: [workshop("mine", "My workshop")] });
  mocks.available.mockReset().mockResolvedValue({ items: [workshop("available", "Available workshop")] });
  mocks.completed.mockReset().mockResolvedValue({ items: [workshop("completed", "Completed workshop")] });
});

describe("instructor My Workshops", () => {
  it.each([
    ["/instructor/f/t11-workshops", "mine"],
    ["/instructor/f/t11-workshops?list=available", "available"],
    ["/instructor/f/t11-workshops?list=completed", "completed"],
  ])("selects the requested list for %s", (path, expected) => {
    expect(parseWorkshopListKind(path)).toBe(expected);
  });

  it("returns themed list data, accurate tab counts and working actions", async () => {
    const payload = (await buildWorkshopList(user, "/instructor/f/t11-workshops?list=available")) as {
      title: string;
      primaryAction: string;
      primaryActionHref: string;
      secondaryAction: string;
      secondaryActionHref: string;
      workshops: { activeTab: string; tabs: string[]; cards: Array<{ title: string; href: string }> };
    };

    expect(payload).toMatchObject({
      title: "Available Workshops",
      primaryAction: "New Workshop Enrolment",
      primaryActionHref: "/instructor/f/t42-new-workshop-enrollment",
      secondaryAction: "Workshop Attendance",
      secondaryActionHref: "/instructor/f/t41-workshop-attendance",
    });
    expect(payload.workshops.tabs).toEqual([
      "My Workshops (1)",
      "Available Workshops (1)",
      "Completed Workshops (1)",
    ]);
    expect(payload.workshops.activeTab).toBe("Available Workshops (1)");
    expect(payload.workshops.cards).toEqual([
      expect.objectContaining({
        title: "Available workshop",
        href: "/instructor/f/t24-workshop-detail?workshopId=available",
      }),
    ]);
  });
});
