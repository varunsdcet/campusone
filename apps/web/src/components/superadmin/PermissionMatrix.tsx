"use client";

import { PERMISSION_LEVELS, type PermissionEntry, type PermissionLevel, type PermissionMap, type PermissionModule } from "@/lib/superAdmin";

const CUSTOM_KEYS = ["view", "create", "edit", "delete"] as const;

/**
 * mode "user": Override unlocks a row so it can differ from the access level default (`defaults`).
 * mode "level": Override marks the module as overridable per user for this access level.
 */
export function PermissionMatrix({
  modules,
  value,
  onChange,
  mode,
  defaults,
}: {
  modules: PermissionModule[];
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  mode: "user" | "level";
  defaults?: PermissionMap;
}) {
  const setRow = (key: string, entry: PermissionEntry) => onChange({ ...value, [key]: entry });

  return (
    <div className="mh-sa__table-wrap">
      <table className="mh-sa__table mh-sa-perm">
        <thead>
          <tr>
            <th>#</th>
            <th>Permission</th>
            <th title={mode === "user" ? "Override the access level default for this user" : "Allow per-user overrides for this module"}>Override</th>
            {PERMISSION_LEVELS.map((l) => (
              <th key={l.key}>{l.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((m, i) => {
            const entry = value[m.key] ?? { override: false, level: "none" as PermissionLevel };
            const locked = mode === "user" && !entry.override;
            return [
              <tr key={m.key}>
                <td>{i + 1}</td>
                <td>{m.label}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Override ${m.label}`}
                    checked={entry.override}
                    onChange={(e) => {
                      const override = e.target.checked;
                      if (mode === "user" && !override && defaults?.[m.key]) {
                        setRow(m.key, { ...defaults[m.key], override: false });
                      } else {
                        setRow(m.key, { ...entry, override });
                      }
                    }}
                  />
                </td>
                {PERMISSION_LEVELS.map((l) => (
                  <td key={l.key}>
                    <input
                      type="radio"
                      name={`perm-${mode}-${m.key}`}
                      aria-label={`${m.label}: ${l.label}`}
                      checked={entry.level === l.key}
                      disabled={locked}
                      onChange={() =>
                        setRow(m.key, {
                          ...entry,
                          level: l.key,
                          ...(l.key === "custom" ? { custom: entry.custom ?? { view: true, create: false, edit: false, delete: false } } : { custom: undefined }),
                        })
                      }
                    />
                  </td>
                ))}
              </tr>,
              entry.level === "custom" ? (
                <tr key={`${m.key}-custom`} className="mh-sa-perm__custom">
                  <td />
                  <td colSpan={6}>
                    <span>Custom access for {m.label}:</span>
                    {CUSTOM_KEYS.map((k) => (
                      <label key={k} className="mh-sa__check">
                        <input
                          type="checkbox"
                          disabled={locked}
                          checked={Boolean(entry.custom?.[k])}
                          onChange={(e) =>
                            setRow(m.key, {
                              ...entry,
                              custom: { view: false, create: false, edit: false, delete: false, ...entry.custom, [k]: e.target.checked },
                            })
                          }
                        />
                        {k[0].toUpperCase() + k.slice(1)}
                      </label>
                    ))}
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
