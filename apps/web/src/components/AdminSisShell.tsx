"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_SIDEBAR, adminChildActive, adminGroupActive, type AdminSidebarEntry } from "@/lib/adminNav";
import { NoModuleAccess, allows, useMyAccess, type MyAccess } from "@/lib/access";
import { AskHeritageFab } from "@/components/AskHeritageFab";
import { logout } from "@/lib/api";
import { useNavCounts } from "@/lib/navCounts";
import { MY_COURSES_LABEL, useMyCoursesNav, withMyCourses } from "@/lib/myCoursesNav";
import packageMetadata from "../../package.json";

const APP_VERSION = packageMetadata.version;

const SIDEBAR_KEY = "mh.sis.sidebar";

const SEARCH_PALETTE = [
  {
    title: "Student search",
    empty: "Press Enter to search live student records.",
    items: [] as Array<{
      label: string;
      detail: string;
      badge: string;
      badgeTone: "active" | "review";
      href: string;
    }>,
  },
];

function NavIcon({ name, active }: { name: string; active?: boolean }) {
  const stroke = active ? "#FFFFFF" : "#8FA3C7";
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
    case "bar-chart":
      return (
        <svg {...common}>
          <path d="M4 20V10M12 20V4M20 20v-7" />
        </svg>
      );
    case "file-text":
      return (
        <svg {...common}>
          <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case "award":
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="5" />
          <path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
          <path d="M6 3v14" />
        </svg>
      );
    case "pie":
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 1 0 9 9h-9V3z" />
          <path d="M14 3.2A9 9 0 0 1 20.8 10H14V3.2z" />
        </svg>
      );
    case "card":
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
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
    case "school":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5z" />
          <path d="M5 10.5V17c0 1.5 3 3 7 3s7-1.5 7-3v-6.5" />
        </svg>
      );
    case "flask":
      return (
        <svg {...common}>
          <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    default:
      return <span style={{ width: 16, height: 16 }} />;
  }
}

function HeaderIcon({ name }: { name: "menu" | "search" | "mail" | "home" }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
  }
}

function footerDate() {
  return new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function visibleSidebar(access: MyAccess | null | undefined): AdminSidebarEntry[] {
  const items: AdminSidebarEntry[] = [];
  for (const entry of ADMIN_SIDEBAR) {
    if (entry.type === "label") {
      items.push(entry);
      continue;
    }
    if (entry.item.hidden || !allows(access, entry.item.gate)) continue;
    const children = entry.item.children?.filter((c) => !c.hidden && allows(access, c.gate));
    items.push({ type: "item", item: { ...entry.item, ...(children ? { children } : {}) } });
  }
  return items.filter((entry, i) => entry.type === "item" || items[i + 1]?.type === "item");
}

function pageBlocked(pathname: string, access: MyAccess | null | undefined) {
  if (access === null) return false;
  for (const entry of ADMIN_SIDEBAR) {
    if (entry.type !== "item" || !adminGroupActive(pathname, entry.item)) continue;
    if (!allows(access, entry.item.gate)) return true;
    const child = entry.item.children?.find((c) => adminChildActive(pathname, c, entry.item.children));
    return Boolean(child && !allows(access, child.gate));
  }
  return false;
}

export function AdminSisShell({
  children,
  activeHref = "/admin",
  navigationPath,
  activeSearch = "",
  breadcrumbs = ["Home", "System Admin", "Dashboard"],
  breadcrumbHrefs,
  userName = "Admin User",
  userRole = "Registrar's Office",
}: {
  children: ReactNode;
  activeHref?: string;
  /** Use an admin route for sidebar state when an admin reviews a shared staff screen. */
  navigationPath?: string;
  activeSearch?: string;
  breadcrumbs?: string[];
  /** Optional link per breadcrumb, aligned by index. */
  breadcrumbHrefs?: Array<string | null | undefined>;
  userName?: string;
  userRole?: string;
}) {
  const router = useRouter();
  const actualPathname = usePathname();
  const pathname = navigationPath || actualPathname || activeHref;
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [today, setToday] = useState("");
  const access = useMyAccess();
  const wantsMyCourses = access !== undefined && visibleSidebar(access).some((e) => e.type === "item" && e.item.label === MY_COURSES_LABEL);
  const myCourses = useMyCoursesNav(wantsMyCourses, pathname);
  const sidebar = useMemo(() => withMyCourses(visibleSidebar(access), myCourses), [access, myCourses]);
  const blocked = pageBlocked(pathname, access);
  const wantsCounts = access !== undefined && sidebar.some((e) => e.type === "item" && (e.item.count || e.item.children?.some((c) => c.count)));
  const counts = useNavCounts(wantsCounts, pathname);

  useEffect(() => {
    const match = ADMIN_SIDEBAR.find(
      (entry) => entry.type === "item" && adminGroupActive(pathname, entry.item) && entry.item.children,
    );
    setOpenGroup(match?.type === "item" ? match.item.href : null);
  }, [pathname]);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "collapsed");
    setToday(footerDate());
  }, []);

  function toggleSidebar(next = !collapsed) {
    setCollapsed(next);
    window.localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
  }

  function submitSearch() {
    const q = searchQ.trim();
    router.push(q ? `/admin/student-search?q=${encodeURIComponent(q)}` : "/admin/student-search");
    setSearchOpen(false);
  }

  const paletteSections = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (q.length < 2) return [];
    return SEARCH_PALETTE.map((section) => ({
      ...section,
      items: section.items.filter((row) => `${row.label} ${row.detail}`.toLowerCase().includes(q)),
    })).filter((section) => section.items.length > 0 || Boolean(section.empty));
  }, [searchQ]);

  const showPalette = searchOpen && searchQ.trim().length >= 2;

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className={`mh-sis${collapsed ? " is-collapsed" : ""}`} data-figma="01-Admin-Dashboard">
      {showPalette ? (
        <button
          type="button"
          className="mh-sis__search-backdrop"
          aria-label="Close search"
          onClick={() => setSearchOpen(false)}
        />
      ) : null}
      <aside className="mh-sis__sidebar" id="mh-sis-sidebar">
        <Link href="/admin" className="mh-sis__brand" aria-label="CampusOne — Home">
          <span className="mh-sis__brand-mark">
            <img src="/brand/campusone/logo.png" alt="CampusOne" width={261} height={64} />
          </span>
        </Link>

        <nav className="mh-sis__nav" aria-label="Admin">
          {sidebar.map((entry, idx) => {
            if (entry.type === "label") {
              return (
                <div key={`label-${entry.label}-${idx}`} className="mh-sis__nav-label">
                  {entry.label}
                </div>
              );
            }
            const { item } = entry;
            const active = adminGroupActive(pathname, item);
            const expanded = Boolean(item.children) && openGroup === item.href;
            return (
              <div key={item.href + item.label} className={`mh-sis__nav-group${active ? " is-active" : ""}`}>
                <button
                  type="button"
                  className={`mh-sis__nav-item${active ? " is-active" : ""}`}
                  aria-expanded={item.children ? expanded : undefined}
                  title={collapsed ? item.label : undefined}
                  onClick={() => {
                    if (item.children) {
                      if (collapsed) {
                        toggleSidebar(false);
                        setOpenGroup(item.href);
                        return;
                      }
                      setOpenGroup((value) => (value === item.href ? null : item.href));
                      return;
                    }
                    setOpenGroup(null);
                    router.push(item.href);
                  }}
                >
                  {active && !item.children ? <span className="mh-sis__nav-marker" /> : null}
                  <span className="mh-sis__nav-icon">
                    <NavIcon name={item.icon} active={active} />
                  </span>
                  <span className="mh-sis__nav-text">{item.label}</span>
                  {item.count && counts[item.count] !== undefined ? (
                    <span className={`mh-sis__nav-count${counts[item.count] ? "" : " is-zero"}`}>{counts[item.count]}</span>
                  ) : null}
                  {item.children ? (
                    <img
                      src="/brand/icons/chevron-right.svg"
                      alt=""
                      width={12}
                      height={12}
                      className="mh-sis__nav-chevron"
                    />
                  ) : null}
                </button>
                {item.children && expanded && !collapsed ? (
                  <div className="mh-sis__nav-sub">
                    {item.children.map((child, ci) => (
                      <div key={child.href + child.label}>
                        {child.section && child.section !== item.children?.[ci - 1]?.section ? (
                          <div className="mh-sis__nav-subsection">{child.section}</div>
                        ) : null}
                        {child.subheading ? <div className="mh-sis__nav-subheading">{child.subheading}</div> : null}
                        <button
                          type="button"
                          className={`mh-sis__nav-subitem${adminChildActive(pathname, child, item.children, activeSearch) ? " is-active" : ""}${child.indent ? " is-indented" : ""}`}
                          onClick={() => router.push(child.href)}
                        >
                          <span className="mh-sis__nav-dot" />
                          {child.label}
                          {child.count && counts[child.count] !== undefined ? (
                            <span className={`mh-sis__nav-count${counts[child.count] ? "" : " is-zero"}`}>{counts[child.count]}</span>
                          ) : null}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="mh-sis__main">
        <header className="mh-sis__header">
          <div className="mh-sis__header-lead">
            <button
              type="button"
              className="mh-sis__toggle"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-controls="mh-sis-sidebar"
              aria-expanded={!collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => toggleSidebar()}
            >
              <HeaderIcon name="menu" />
            </button>
            <div className="mh-sis__crumbs">
              {breadcrumbs.map((crumb, i) => (
                <span key={`${i}:${crumb}`} className="mh-sis__crumb">
                  {i > 0 ? (
                    <img src="/brand/icons/chevron-right.svg" alt="" width={12} height={12} className="mh-sis__crumb-chevron" />
                  ) : null}
                  {breadcrumbHrefs?.[i] && i < breadcrumbs.length - 1 ? (
                    <Link href={breadcrumbHrefs[i]!} className="mh-sis__crumb-link">
                      {crumb}
                    </Link>
                  ) : (
                    <span className={i === breadcrumbs.length - 1 ? "is-current" : undefined}>{crumb}</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="mh-sis__header-actions">
            <div className="mh-sis__search-wrap">
              <label className={`mh-sis__search mh-sis__search--input${showPalette ? " is-open" : ""}`}>
                <input
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitSearch();
                    if (e.key === "Escape") setSearchOpen(false);
                  }}
                  placeholder="Student # or last name"
                  aria-label="Search students by student number or last name"
                  aria-expanded={showPalette}
                />
                {searchQ ? (
                  <button
                    type="button"
                    className="mh-sis__search-clear"
                    aria-label="Clear search"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSearchQ("");
                      setSearchOpen(false);
                    }}
                  >
                    ×
                  </button>
                ) : null}
                <button
                  type="button"
                  className="mh-sis__search-go"
                  aria-label="Search"
                  title="Search"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={submitSearch}
                >
                  <HeaderIcon name="search" />
                </button>
              </label>
              {showPalette ? (
                <div className="mh-sis__search-palette" role="listbox" data-figma-id="178:5">
                  {paletteSections.map((section) => (
                    <div key={section.title} className="mh-sis__search-section">
                      <div className="mh-sis__search-section-title">{section.title}</div>
                      {section.items.length ? (
                        section.items.map((hit) => (
                          <button
                            key={hit.href + hit.label + hit.detail}
                            type="button"
                            className="mh-sis__search-palette-item"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              router.push(hit.href);
                              setSearchOpen(false);
                              setSearchQ("");
                            }}
                          >
                            <span className="mh-sis__search-palette-copy">
                              <strong>{hit.label}</strong>
                              <span>{hit.detail}</span>
                            </span>
                            <span
                              className={`mh-sis__search-pill${hit.badgeTone === "review" ? " is-review" : " is-active"}`}
                            >
                              {hit.badge}
                            </span>
                          </button>
                        ))
                      ) : section.empty ? (
                        <p className="mh-sis__search-empty">{section.empty}</p>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="mh-sis__search-palette-all"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      router.push("/admin/search");
                      setSearchOpen(false);
                    }}
                  >
                    {`View all results for "${searchQ.trim()}" →`}
                  </button>
                </div>
                ) : null}
            </div>
            <button type="button" className="mh-sis__logout-link" onClick={() => router.push("/admin/student-search")}>
              Advanced Search
            </button>
            <div className="mh-sis__shortcuts">
              <button type="button" className="mh-sis__shortcut" aria-label="Messages" title="Messages" onClick={() => router.push("/admin/messages")}>
                <HeaderIcon name="mail" />
              </button>
              <button type="button" className="mh-sis__shortcut" aria-label="Home" title="Home" onClick={() => router.push("/admin")}>
                <HeaderIcon name="home" />
              </button>
            </div>
            <button type="button" className="mh-sis__copilot" onClick={() => router.push("/admin/ai/ask")}>
              <img src="/brand/icons/sparkle.svg" alt="" width={14} height={14} />
              <span>Ask CampusOne AI</span>
            </button>
            <button type="button" className="mh-sis__bell" aria-label="Notifications" onClick={() => router.push("/admin/ops/workspace/notifications")}>
              <img src="/brand/icons/bell.svg" alt="" width={16} height={16} />
            </button>
            <div className="mh-sis__profile">
              <span className="mh-sis__avatar" aria-hidden>
                {userName
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join("") || "AU"}
              </span>
              <span className="mh-sis__profile-meta">
                <span className="mh-sis__profile-name">{userName}</span>
                <span>
                  <button type="button" className="mh-sis__logout-link" onClick={() => router.push("/admin/faculty-profile/biography")}>
                    My Profile
                  </button>
                  {" · "}
                  <button type="button" className="mh-sis__logout-link" onClick={signOut}>
                    Log Out
                  </button>
                </span>
              </span>
            </div>
          </div>
        </header>

        <div className="mh-sis__scroll">{blocked ? access === undefined ? null : <NoModuleAccess /> : children}</div>
        <footer className="mh-sis__footer">
          <span>Version {APP_VERSION}</span>
          {today ? (
            <>
              <span aria-hidden>|</span>
              <span>{today}</span>
            </>
          ) : null}
        </footer>
        <AskHeritageFab role="admin" />
      </div>
    </div>
  );
}
