"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AskHeritageFab } from "@/components/AskHeritageFab";
import { logout } from "@/lib/api";

type NavLeaf = {
  label: string;
  href: string;
  icon: string;
  badge?: string;
};

type NavGroup = {
  type: "group";
  label: string;
  icon: string;
  children: NavLeaf[];
};

type NavEntry = { type: "item"; item: NavLeaf } | NavGroup;

const PROFILE_GROUP_HREFS = new Set([
  "/instructor/f/t02-profile-biography",
  "/instructor/f/t03-profile-topics",
  "/instructor/f/t04-profile-availability",
  "/instructor/f/t05-profile-compensation",
  "/instructor/f/t06-profile-schedule",
  "/instructor/f/t15-settings",
  "/instructor/f/t25-add-availability-modal",
  "/instructor/f/t34-accomplishments",
  "/instructor/f/t35-security-settings",
]);

const NAV: NavEntry[] = [
  { type: "item", item: { label: "Dashboard", href: "/instructor", icon: "home" } },
  {
    type: "group",
    label: "My Profile / Settings",
    icon: "user",
    children: [
      { label: "Manage My Profile", href: "/instructor/f/t02-profile-biography", icon: "user" },
      { label: "Accomplishments", href: "/instructor/f/t34-accomplishments", icon: "award" },
      { label: "Security Settings", href: "/instructor/f/t35-security-settings", icon: "shield" },
      { label: "Change Time Zone", href: "/instructor/f/t15-settings", icon: "clock" },
    ],
  },
  { type: "item", item: { label: "My Courses", href: "/instructor/sections", icon: "book" } },
  { type: "item", item: { label: "Workshops", href: "/instructor/f/t11-workshops", icon: "users" } },
  {
    type: "item",
    item: { label: "Students", href: "/instructor/f/t12-students-view", icon: "graduation", badge: "2,160" },
  },
  {
    type: "item",
    item: { label: "Program Management", href: "/instructor/f/t13-program-management", icon: "layers" },
  },
  {
    type: "item",
    item: { label: "Course Management", href: "/instructor/f/t14-course-management", icon: "grid" },
  },
];

const SEARCH_PALETTE = [
  {
    title: "Courses",
    items: [
      {
        label: "ACC201 · Financial Accounting I",
        detail: "Fall 2026 · Hall A-102 · 42 enrolled",
        badge: "Active",
        badgeTone: "active" as const,
        href: "/instructor/f/t08-my-courses-detail",
      },
      {
        label: "FIN301 · Corporate Finance",
        detail: "Fall 2026 · Hall B-204 · 38 enrolled",
        badge: "Active",
        badgeTone: "active" as const,
        href: "/instructor/sections",
      },
    ],
  },
  {
    title: "Students",
    items: [
      {
        label: "Marcus Vance",
        detail: "ACC201 Section A · Active",
        badge: "Enrolled",
        badgeTone: "active" as const,
        href: "/instructor/f/t12-students-view",
      },
    ],
  },
  {
    title: "Actions",
    items: [
      {
        label: "Mark Attendance",
        detail: "Open today's attendance sessions",
        badge: "Quick",
        badgeTone: "review" as const,
        href: "/instructor/attendance",
      },
      {
        label: "Enter Grades",
        detail: "12 submissions pending",
        badge: "Due",
        badgeTone: "review" as const,
        href: "/instructor/gradebook",
      },
    ],
  },
];

function NavIcon({ name, active }: { name: string; active?: boolean }) {
  const stroke = active ? "#2563EB" : "#8D928A";
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      );
    case "award":
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="5" />
          <path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
          <path d="M6 3v14" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "graduation":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5z" />
          <path d="M5 10.5V17c0 1.5 3 3 7 3s7-1.5 7-3v-6.5" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="m12 2 9 5-9 5-9-5 9-5z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 17 9 5 9-5" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common} width={12} height={12}>
          <path d="m8 10 4 4 4-4" />
        </svg>
      );
    case "message":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5M21 12H9" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
        </svg>
      );
    default:
      return <span style={{ width: 16, height: 16 }} />;
  }
}

function FooterIcon({ name }: { name: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#8D928A",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "message":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5M21 12H9" />
        </svg>
      );
    default:
      return null;
  }
}

export function TeacherShell({
  children,
  activeHref = "/instructor",
  breadcrumbs = ["Home", "Dashboard"],
  userName = "Dr. Sarah Mitchell",
  userRole = "Lead Instructor",
}: {
  children: ReactNode;
  activeHref?: string;
  breadcrumbs?: string[];
  userName?: string;
  userRole?: string;
}) {
  const router = useRouter();
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const profileGroupActive = PROFILE_GROUP_HREFS.has(activeHref);
  const [profileOpen, setProfileOpen] = useState(profileGroupActive);

  const groupOpen = profileOpen;

  const paletteSections = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (q.length < 2) return [];
    return SEARCH_PALETTE.map((section) => ({
      ...section,
      items: section.items.filter((row) => `${row.label} ${row.detail}`.toLowerCase().includes(q)),
    })).filter((section) => section.items.length > 0);
  }, [searchQ]);

  const showPalette = searchOpen && searchQ.trim().length >= 2;

  const nameParts = userName
    .replace(/^Dr\.\s+/i, "")
    .split(" ")
    .filter(Boolean);
  const footerInitials =
    nameParts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "SM";
  const footerShortName = "T. Mitchell";

  return (
    <div className="mh-teacher" data-figma="T01-Teacher-Dashboard">
      {showPalette ? (
        <button
          type="button"
          className="mh-teacher__search-backdrop"
          aria-label="Close search"
          onClick={() => setSearchOpen(false)}
        />
      ) : null}

      <aside className="mh-teacher__sidebar">
        <button
          type="button"
          className="mh-teacher__brand mh-teacher__brand--logo"
          aria-label="CampusOne"
          onClick={() => router.push("/instructor")}
        >
          <img
            src="/brand/campusone/logo.png"
            alt="CampusOne"
            className="mh-teacher__brand-logo"
          />
        </button>

        <nav className="mh-teacher__nav" aria-label="Teacher">
          {NAV.map((entry) => {
            if (entry.type === "group") {
              const childActive = entry.children.some((c) => c.href === activeHref) || profileGroupActive;
              return (
                <div key={entry.label} className="mh-teacher__nav-group">
                  <button
                    type="button"
                    className={`mh-teacher__nav-item mh-teacher__nav-item--group${childActive ? " is-active" : ""}`}
                    aria-expanded={groupOpen}
                    onClick={() => setProfileOpen((open) => !open)}
                  >
                    {childActive ? <span className="mh-teacher__nav-marker" /> : null}
                    <span className="mh-teacher__nav-icon">
                      <NavIcon name={entry.icon} active={childActive} />
                    </span>
                    <span className="mh-teacher__nav-text">{entry.label}</span>
                    <span className={`mh-teacher__nav-chevron${groupOpen ? " is-open" : ""}`}>
                      <NavIcon name="chevron" active={childActive} />
                    </span>
                  </button>
                  {groupOpen
                    ? entry.children.map((child) => {
                        const active = activeHref === child.href;
                        return (
                          <button
                            key={child.href}
                            type="button"
                            className={`mh-teacher__nav-item mh-teacher__nav-item--sub${active ? " is-active" : ""}`}
                            onClick={() => router.push(child.href)}
                          >
                            {active ? <span className="mh-teacher__nav-marker" /> : null}
                            <span className="mh-teacher__nav-text">{child.label}</span>
                          </button>
                        );
                      })
                    : null}
                </div>
              );
            }

            const { item } = entry;
            const active = activeHref === item.href;
            return (
              <button
                key={item.href}
                type="button"
                className={`mh-teacher__nav-item${active ? " is-active" : ""}`}
                onClick={() => router.push(item.href)}
              >
                {active ? <span className="mh-teacher__nav-marker" /> : null}
                <span className="mh-teacher__nav-icon">
                  <NavIcon name={item.icon} active={active} />
                </span>
                <span className="mh-teacher__nav-text">{item.label}</span>
                {item.badge ? <span className="mh-teacher__nav-badge">{item.badge}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="mh-teacher__footer-card">
          <div className="mh-teacher__footer-user">
            <span className="mh-teacher__footer-avatar" aria-hidden>
              {footerInitials}
            </span>
            <span className="mh-teacher__footer-meta">
              <span className="mh-teacher__footer-name">{footerShortName}</span>
              <span className="mh-teacher__footer-role">{userRole}</span>
            </span>
          </div>
          <div className="mh-teacher__footer-actions">
            <button type="button" aria-label="Messages" onClick={() => router.push("/instructor/messages")}>
              <FooterIcon name="message" />
            </button>
            <button type="button" aria-label="Home" onClick={() => router.push("/instructor")}>
              <FooterIcon name="home" />
            </button>
            <button type="button" aria-label="Notifications" onClick={() => router.push("/instructor/notifications")}>
              <FooterIcon name="bell" />
            </button>
            <button
              type="button"
              aria-label="Log out"
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
            >
              <FooterIcon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <div className="mh-teacher__main">
        <header className="mh-teacher__header">
          <div className="mh-teacher__crumbs">
            {breadcrumbs.map((crumb, i) => (
              <span key={`${crumb}-${i}`} className="mh-teacher__crumb">
                {i > 0 ? <span className="mh-teacher__crumb-sep" aria-hidden>/</span> : null}
                <span className={i === breadcrumbs.length - 1 ? "is-current" : undefined}>{crumb}</span>
              </span>
            ))}
          </div>

          <div className="mh-teacher__header-actions">
            <div className="mh-teacher__search-wrap">
              <label className={`mh-teacher__search${showPalette ? " is-open" : ""}`}>
                <NavIcon name="search" />
                <input
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setSearchOpen(false);
                  }}
                  placeholder="Search classes..."
                  aria-label="Search classes"
                  aria-expanded={showPalette}
                />
              </label>
              {showPalette ? (
                <div className="mh-teacher__search-palette" role="listbox">
                  {paletteSections.map((section) => (
                    <div key={section.title} className="mh-teacher__search-section">
                      <div className="mh-teacher__search-section-title">{section.title}</div>
                      {section.items.map((hit) => (
                        <button
                          key={hit.href + hit.label}
                          type="button"
                          className="mh-teacher__search-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            router.push(hit.href);
                            setSearchOpen(false);
                            setSearchQ("");
                          }}
                        >
                          <span className="mh-teacher__search-copy">
                            <strong>{hit.label}</strong>
                            <span>{hit.detail}</span>
                          </span>
                          <span
                            className={`mh-teacher-badge${hit.badgeTone === "review" ? " is-warning" : " is-active"}`}
                          >
                            {hit.badge}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="mh-teacher__bell"
              aria-label="Notifications"
              onClick={() => router.push("/instructor/notifications")}
            >
              <NavIcon name="bell" />
              <span className="mh-teacher__bell-badge">3</span>
            </button>

            <div className="mh-teacher__profile">
              <img
                src="/brand/teacher/avatar.png"
                alt=""
                width={32}
                height={32}
                className="mh-teacher__avatar mh-teacher__avatar--photo"
              />
              <span className="mh-teacher__profile-meta">
                <span className="mh-teacher__profile-name">{userName}</span>
                <span className="mh-teacher__profile-role">{userRole}</span>
              </span>
            </div>
          </div>
        </header>

        <div className="mh-teacher__scroll">{children}</div>
        <AskHeritageFab role="instructor" />
      </div>
    </div>
  );
}
