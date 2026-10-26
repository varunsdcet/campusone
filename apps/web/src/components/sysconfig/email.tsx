"use client";

import { SuperFrame } from "@/components/superadmin/shared";
import { Directory, SC, SettingsBody, Tabs, useTab } from "./directory";
import { fmtDate, str, type Row } from "./kit";

const EMAIL = "/admin/sysconfig/email";
const TABS = [
  { id: "general", label: "General Settings" },
  { id: "filters", label: "Filters & Forwarding" },
  { id: "departments", label: "Departments & Groups" },
  { id: "mailmerge", label: "Mail Merge Templates" },
  { id: "sms", label: "SMS Providers" },
  { id: "whitelist", label: "Verified Addresses" },
  { id: "blocked", label: "Blocked Users" },
  { id: "bounces", label: "Bounces & Complaints" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const common = { embedded: true, activeHref: EMAIL, createMode: "modal" as const, initialNotice: null };

function TabBody({ tab }: { tab: Tab }) {
  switch (tab) {
    case "general":
      return <SettingsBody settingsKey="emailGeneral" embedded />;
    case "filters":
      return (
        <Directory
          {...common}
          entity="emailFilters"
          noun="e-mail filter"
          createLabel="Create Filter"
          modalTitle={(r) => (r ? `Edit E-mail Filter: ${str(r.name)}` : "Create E-mail Filter")}
          saveLabel="Save Filter"
          empty="No e-mail filters or forwarding rules have been created yet."
          filter={{ placeholder: "Enter Filter Name or Content", keys: ["name", "content", "type"] }}
          columns={[
            { label: "Filter Name", render: (r) => <strong>{str(r.name)}</strong> },
            { label: "Filter Type", render: (r) => str(r.type) },
            { label: "Apply Rule To", render: (r) => str(r.applyTo) },
            { label: "Filter Content", render: (r) => <code>{str(r.content)}</code> },
            { label: "Destination", render: (r) => str(r.forwardTo || r._departmentLabel) || <span className="mh-sa__muted">—</span> },
          ]}
        />
      );
    case "departments":
      return (
        <Directory
          {...common}
          entity="emailDepartments"
          noun="department / group"
          createLabel="Create Department / Group"
          modalTitle={(r) => (r ? `Edit Department / Group: ${str(r.name)}` : "Create Department / Group")}
          saveLabel="Save Department / Group"
          empty="No departments or groups have been created yet."
          columns={[
            { label: "Department Name", render: (r) => <strong>{str(r.name)}</strong> },
            { label: "Users", render: (r) => (Array.isArray(r._usersLabels) && r._usersLabels.length ? (r._usersLabels as string[]).join(", ") : <span className="mh-sa__muted">No users</span>) },
            { label: "Access", render: (r) => str(r.access) },
          ]}
        />
      );
    case "mailmerge":
      return (
        <Directory
          {...common}
          entity="mailMergeTemplates"
          noun="mail merge template"
          createLabel="Create Mail Merge Template"
          modalTitle={(r) => (r ? `Edit Mail Merge Template: ${str(r.name)}` : "Create Mail Merge Template")}
          saveLabel="Save Template"
          empty="No mail merge templates have been created yet."
          filter={{ placeholder: "Enter Template Name", keys: ["name"] }}
          columns={[
            { label: "Template Name", render: (r) => <strong>{str(r.name)}</strong> },
            { label: "Language", render: (r) => str(r.language) },
            { label: "Access", render: (r) => str(r.access) },
          ]}
        />
      );
    case "sms":
      return (
        <Directory
          {...common}
          entity="smsProviders"
          noun="SMS provider"
          createLabel="Add SMS Provider"
          modalTitle={(r) => (r ? `Edit SMS Provider: ${str(r.name)}` : "Add SMS Provider")}
          saveLabel="Save SMS Provider"
          empty="No SMS providers have been added yet."
          columns={[
            { label: "Provider Name", render: (r) => <strong>{str(r.name)}</strong> },
            { label: "Provider Domain", render: (r) => <code>{str(r.domain)}</code> },
          ]}
          below={() => <p className="lx-hint">Text messages are delivered as e-mail to number@provider-domain, e.g. 6045551234@txt.bell.ca.</p>}
        />
      );
    case "whitelist":
      return (
        <Directory
          {...common}
          entity="whitelist"
          noun="whitelisted e-mail address"
          createLabel="Add E-mail Address"
          modalTitle={(r) => (r ? "Edit Whitelisted E-mail Address" : "Add E-mail Address to Whitelist")}
          saveLabel="Save E-mail Address"
          empty="No e-mail addresses have been whitelisted yet."
          filter={{ placeholder: "Search whitelisted e-mail addresses", label: "Search Whitelist", keys: ["email"], submitLabel: "Search", live: true }}
          columns={[
            { label: "E-mail Address", render: (r) => <strong>{str(r.email)}</strong> },
            { label: "Added", render: (r) => fmtDate(str(r.updatedAt)) },
          ]}
          confirmText={(r) => `Remove ${str(r.email)} from the whitelist?`}
          deleteLabel="Remove"
        />
      );
    case "blocked":
      return (
        <Directory
          {...common}
          entity="blockedUsers"
          noun="blocked user"
          createLabel="Add User to Block List"
          modalTitle={() => "Add User to Sender Block List"}
          saveLabel="Block User"
          empty="No users are blocked from sending e-mail."
          filter={{ placeholder: "Enter a name", keys: ["_userLabel"] }}
          canEdit={() => false}
          deleteLabel="Unblock"
          confirmText={(r: Row) => `Allow ${str(r._userLabel)} to send e-mail again?`}
          columns={[
            { label: "User", render: (r) => <strong>{str(r._userLabel)}</strong> },
            { label: "Blocked Since", render: (r) => fmtDate(str(r.updatedAt)) },
          ]}
        />
      );
    case "bounces":
      return (
        <Directory
          {...common}
          entity="bounces"
          noun="bounce / complaint"
          createMode="none"
          empty="No bounces or complaints have been reported."
          filter={{ placeholder: "Enter E-mail Address", label: "E-mail Address", keys: ["email"], submitLabel: "Search", live: true }}
          selects={[{ key: "type", label: "Type", all: "All Types", options: () => ["Bounced", "Complaint"], match: (r, v) => r.type === v }]}
          pageSize={25}
          canEdit={() => false}
          deleteLabel="Dismiss"
          confirmText={(r) => `Dismiss the ${str(r.type).toLowerCase()} report for ${str(r.email)}? E-mail delivery to this address resumes.`}
          columns={[
            { label: "E-mail Address", render: (r) => <strong>{str(r.email)}</strong> },
            { label: "Type", render: (r) => <span className={`sx-badge sx-badge--${r.type === "Complaint" ? "red" : "amber"}`}>{str(r.type)}</span> },
            { label: "Context", render: (r) => str(r.context) },
            { label: "Date Stamp", render: (r) => str(r.stamp) },
          ]}
        />
      );
  }
}

export function EmailSystem() {
  const [tab, setTab] = useTab(TABS.map((t) => t.id), "general");
  return (
    <SuperFrame title="E-mail Configuration" breadcrumbs={["Home", SC, "E-mail System Management"]} activeHref={EMAIL}>
      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
      <TabBody key={tab} tab={tab} />
    </SuperFrame>
  );
}
