"use client";

import { useState } from "react";
import { SuperFrame } from "@/components/superadmin/shared";
import { Directory, EntityModal, SC, SettingsBody } from "./directory";
import { str, type Row } from "./kit";

export function GlobalSettings() {
  return (
    <SuperFrame title="Global Settings" breadcrumbs={["Home", SC, "Global Settings"]} activeHref="/admin/sysconfig/global-settings">
      <SettingsBody settingsKey="global" />
    </SuperFrame>
  );
}

const PLUGINS = "/admin/sysconfig/plugins";

export function Plugins() {
  const [endpoint, setEndpoint] = useState(false);
  const [bump, setBump] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <>
      <Directory
        entity="plugins"
        title="Manage Plug-ins"
        activeHref={PLUGINS}
        noun="plug-in"
        createMode="modal"
        empty="No plug-ins are available."
        filter={{ placeholder: "Enter Plug-in Name", keys: ["name", "group", "description"] }}
        editLabel="Settings"
        canDelete={() => false}
        modalTitle={(r) => `Plug-in Settings: ${str(r?.name)}`}
        saveLabel="Save Plug-in Settings"
        headerActions={(ctx) =>
          ctx.canEdit ? (
            <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setEndpoint(true)}>
              Create Custom Endpoint
            </button>
          ) : null
        }
        groups={(rows) => {
          const order: string[] = [];
          for (const r of rows) if (!order.includes(str(r.group))) order.push(str(r.group));
          return order.map((g) => ({ title: g, rows: rows.filter((r) => str(r.group) === g) }));
        }}
        columns={[
          { label: "Plug-in", render: (r) => <strong>{str(r.name)}</strong> },
          { label: "Description", render: (r) => <span className="mh-sa__muted">{str(r.description)}</span> },
          { label: "Status", render: (r) => <span className={`sx-badge sx-badge--${r.status === "Enabled" ? "green" : "grey"}`}>{str(r.status)}</span> },
        ]}
        below={() => (
          <div className="sx-group">
            <div className="sx-group__head">
              <h3>Custom Endpoints</h3>
            </div>
            <Directory
              key={bump}
              embedded
              initialNotice={saved}
              entity="customEndpoints"
              activeHref={PLUGINS}
              noun="custom endpoint"
              createMode="modal"
              modalTitle={(r) => (r ? `Edit Custom Endpoint: ${str(r.name)}` : "Create Custom Endpoint")}
              saveLabel="Save Custom Endpoint"
              empty="No custom endpoints have been created yet."
              columns={[
                { label: "Endpoint Name", render: (r: Row) => <strong>{str(r.name)}</strong> },
                { label: "Endpoint", render: (r: Row) => <code>{`${str(r.method)} ${str(r.url)}`}</code> },
                { label: "Send When", render: (r: Row) => str(r.trigger) },
                { label: "Status", render: (r: Row) => <span className={`sx-badge sx-badge--${r.status === "Enabled" ? "green" : "grey"}`}>{str(r.status)}</span> },
              ]}
            />
          </div>
        )}
      />
      {endpoint ? (
        <EntityModal
          entity="customEndpoints"
          id={null}
          title="Create Custom Endpoint"
          saveLabel="Save Custom Endpoint"
          onClose={() => setEndpoint(false)}
          onSaved={(m) => {
            setEndpoint(false);
            setSaved(m);
            setBump((b) => b + 1);
          }}
        />
      ) : null}
    </>
  );
}
