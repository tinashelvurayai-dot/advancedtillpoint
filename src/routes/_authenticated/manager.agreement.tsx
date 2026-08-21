import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { HandoverReceipt } from "@/components/handover-receipt";

export const Route = createFileRoute("/_authenticated/manager/agreement")({
  head: () => ({
    meta: [
      { title: "Handover & Acceptance Agreement - TillPoint Retail OS" },
      {
        name: "description",
        content:
          "The final POS software development, handover and acceptance agreement for TillPoint Retail OS.",
      },
      { property: "og:title", content: "Handover & Acceptance Agreement - TillPoint Retail OS" },
      {
        property: "og:description",
        content:
          "The final POS software development, handover and acceptance agreement for TillPoint Retail OS.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgreementPage,
});

const KEY = "tillpoint.handover.agreement.v3";

const RECORD: Array<[string, string]> = [
  ["Agreement Date", "17 August 2026"],
  ["Project Name", "TillPoint Retail OS"],
  ["Software Type", "Cloud-Based Point of Sale (POS) & Retail Management System"],
  ["Application URL", "https://advanced-pos-tillpoint.vercel.app"],
  ["Developers", "codedevelopers151@gmail.com"],
  ["Client", "Mr Pride Tatire"],
  ["Client Contact", "+263 77 688 9832"],
  ["Document Version", "Version 1.0"],
  ["Status", "Final Handover & Acceptance"],
];

type Block = { title: string; intro?: string; groups?: Array<{ label?: string; items: string[] }> };

const SECTIONS: Block[] = [
  {
    title: "1. PREAMBLE",
    intro:
      'This POS Software Development, Handover & Acceptance Agreement ("Agreement") is entered into on 17 August 2026 between the Developers and Mr Pride Tatire ("the Client"). The purpose of this Agreement is to formally record the successful completion, demonstration, delivery, handover and acceptance of the custom-developed TillPoint Retail OS Point-of-Sale System. This document serves as the official record confirming that the software has been developed according to the agreed project scope and has been presented to the Client for operational use.',
  },
  {
    title: "2. PROJECT OVERVIEW",
    intro:
      "The Developers successfully designed and implemented a modern retail Point-of-Sale platform capable of managing day-to-day business operations through an integrated cloud-based system. The software combines sales processing, inventory control, cashier management, reporting, offline capabilities and business analytics into one centralized application suitable for retail environments.",
  },
  {
    title: "3. PROJECT OBJECTIVES",
    intro: "The primary objectives of the project were to:",
    groups: [
      {
        items: [
          "Develop a modern retail management platform.",
          "Improve inventory visibility.",
          "Streamline cashier operations.",
          "Automate sales recording.",
          "Enable offline checkout functionality.",
          "Reduce manual stock management.",
          "Improve financial reporting.",
          "Provide secure role-based access.",
          "Support business scalability.",
          "Deliver a production-ready application.",
        ],
      },
    ],
  },
  {
    title: "4. SCOPE OF WORK COMPLETED",
    intro: "The Developers completed the following project activities:",
    groups: [
      {
        label: "System Analysis",
        items: [
          "Business workflow analysis",
          "Retail process planning",
          "Database planning",
          "User role definition",
        ],
      },
      {
        label: "System Design",
        items: [
          "User Interface (UI) Design",
          "User Experience (UX) Design",
          "Navigation Structure",
          "Mobile Responsiveness",
        ],
      },
      {
        label: "Development",
        items: [
          "Frontend Development",
          "Backend Integration",
          "Database Configuration",
          "Authentication",
          "Authorization",
          "Data Validation",
        ],
      },
      {
        label: "Implementation",
        items: [
          "Inventory Module",
          "Sales Module",
          "Cashier Module",
          "Reporting Module",
          "Offline Module",
          "Synchronization Engine",
        ],
      },
      {
        label: "Deployment",
        items: [
          "Production Deployment",
          "Cloud Hosting Configuration",
          "Environment Configuration",
          "Application Publishing",
        ],
      },
      {
        label: "Quality Assurance",
        items: [
          "Functional Testing",
          "Performance Testing",
          "User Acceptance Demonstration",
          "Bug Fixes",
          "Production Verification",
        ],
      },
    ],
  },
  {
    title: "5. SYSTEM FEATURES DELIVERED",
    intro:
      "The delivered system includes, but is not limited to, the following capabilities:",
    groups: [
      {
        label: "Management Dashboard",
        items: [
          "Business overview",
          "Sales summaries",
          "Performance metrics",
          "Revenue tracking",
          "Operational statistics",
        ],
      },
      {
        label: "Cashier Dashboard",
        items: [
          "Sales interface",
          "Barcode-ready workflow",
          "Cart management",
          "Receipt generation",
          "Customer checkout",
        ],
      },
      {
        label: "Product Management",
        items: [
          "Product creation",
          "Product editing",
          "Product deletion",
          "Categories",
          "Brands",
          "Product variants",
          "Pricing management",
        ],
      },
      {
        label: "Inventory Management",
        items: [
          "Stock levels",
          "Stock adjustments",
          "Stock-In Records",
          "Low stock alerts",
          "Inventory valuation",
        ],
      },
      {
        label: "Sales Management",
        items: [
          "Sales history",
          "Transaction lookup",
          "Daily sales",
          "Monthly sales",
          "Sales exports",
          "Sales analytics",
        ],
      },
      { label: "Order Management", items: ["Customer orders", "Order status", "Order tracking"] },
      {
        label: "Expense Management",
        items: ["Expense recording", "Expense categorization", "Expense reporting"],
      },
      { label: "Supplier Management", items: ["Supplier information", "Supplier records"] },
      {
        label: "Reporting",
        items: [
          "Sales reports",
          "Inventory reports",
          "Profit reports",
          "Operational summaries",
        ],
      },
      {
        label: "Offline Operations",
        items: [
          "Offline checkout",
          "Local transaction storage",
          "Automatic synchronization",
          "Queue management",
        ],
      },
      {
        label: "Administrative Features",
        items: [
          "Role management",
          "User permissions",
          "System settings",
          "Operational manuals",
        ],
      },
    ],
  },
  {
    title: "6. HANDOVER MATERIALS",
    intro: "The Developers have provided the Client with the following:",
    groups: [
      {
        items: [
          "Fully deployed production application.",
          "Operational system walkthrough.",
          "Manager dashboard demonstration.",
          "Cashier dashboard demonstration.",
          "Product management workflow.",
          "Inventory workflow.",
          "Stock-In workflow.",
          "Offline checkout workflow.",
          "Synchronization process.",
          "Sales reporting procedures.",
          "Export functionality.",
          "Administrative configuration.",
          "Operational guidance.",
        ],
      },
    ],
  },
  {
    title: "7. CLIENT ACCEPTANCE TESTING",
    intro: "The Client has reviewed and verified the principal system workflows, including:",
    groups: [
      {
        items: [
          "Manager operations",
          "Cashier sales process",
          "Product creation",
          "Product updates",
          "Product variants",
          "Inventory visibility",
          "Stock-In Records",
          "Sales recording",
          "Offline checkout",
          "Offline synchronization",
          "Reporting",
          "Data exports",
          "User management",
          "Administrative settings",
        ],
      },
      {
        label: "Confirmation",
        items: [
          "Following the demonstration and review, the Client confirms that the software performs substantially in accordance with the agreed project objectives.",
        ],
      },
    ],
  },
  {
    title: "8. FEES AND PAYMENT",
    intro:
      "Total Software Development Fee: USD $170.00. Payment receipts and related financial records shall be retained by both parties for accounting and reference purposes.",
  },
  {
    title: "9. WARRANTY AND POST-HANDOVER SUPPORT",
    intro:
      "The Developers shall provide reasonable clarification relating to the operation of the delivered system during the handover period. The following are not included within the original project scope unless agreed separately in writing:",
    groups: [
      {
        items: [
          "New feature requests",
          "Major design changes",
          "Third-party integrations",
          "Business process redesign",
          "Additional modules",
          "Future enhancements",
          "Large-scale modifications",
        ],
      },
      {
        label: "Note",
        items: [
          "Such work shall be treated as separate development projects and may be subject to additional quotations.",
        ],
      },
    ],
  },
  {
    title: "10. CLIENT RESPONSIBILITIES",
    intro: "The Client agrees to:",
    groups: [
      {
        items: [
          "Maintain accurate product information.",
          "Maintain inventory records.",
          "Control authorized user access.",
          "Protect login credentials.",
          "Maintain operational backups where applicable.",
          "Make business decisions relating to system usage.",
          "Retain payment documentation.",
        ],
      },
    ],
  },
  {
    title: "11. DEVELOPER RESPONSIBILITIES",
    intro: "The Developers confirm that they have:",
    groups: [
      {
        items: [
          "Delivered the agreed software.",
          "Configured the production deployment.",
          "Demonstrated the major workflows.",
          "Performed reasonable testing.",
          "Completed operational handover.",
          "Provided implementation guidance.",
        ],
      },
    ],
  },
  {
    title: "12. CONFIDENTIALITY",
    intro:
      "Both parties agree to exercise reasonable care in protecting confidential information exchanged during the development, deployment and operation of the system. Confidential information includes, but is not limited to:",
    groups: [
      {
        items: [
          "Business information",
          "Commercial information",
          "Technical documentation",
          "Source configurations",
          "User credentials",
          "Internal operational procedures",
        ],
      },
      {
        label: "Note",
        items: [
          "Neither party shall disclose confidential information without prior written consent except where required by law.",
        ],
      },
    ],
  },
  {
    title: "13. LIMITATION OF LIABILITY",
    intro:
      "Following acceptance of the system, the Developers shall not be responsible for losses arising from:",
    groups: [
      {
        items: [
          "Incorrect data entry",
          "Unauthorized user access",
          "Hardware failures",
          "Internet outages",
          "Third-party service interruptions",
          "Improper system usage",
          "Failure to maintain operational backups",
        ],
      },
    ],
  },
  {
    title: "14. FINAL ACCEPTANCE",
    intro: "By signing this Agreement, the Client acknowledges that:",
    groups: [
      {
        items: [
          "The software has been demonstrated.",
          "The principal functionality has been reviewed.",
          "The agreed scope has been delivered.",
          "Operational handover has been completed.",
          "The Client accepts the delivered system subject to any written exceptions recorded below.",
        ],
      },
      { label: "Note", items: ["This Agreement constitutes the official project completion record."] },
    ],
  },
];

const initial = {
  developerOne: "",
  developerTwo: "",
  clientSigner: "Mr Pride Tatire",
  exceptions: "",
};

function readAgreement(): typeof initial {
  if (typeof window === "undefined") return initial;
  try {
    return { ...initial, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return initial;
  }
}

function buildDocument(form: typeof initial): string {
  const lines: string[] = [
    "POS SOFTWARE DEVELOPMENT, HANDOVER & ACCEPTANCE AGREEMENT",
    "",
    "EXECUTIVE RECORD",
    ...RECORD.map(([k, v]) => `${k}: ${v}`),
    "",
  ];
  for (const s of SECTIONS) {
    lines.push(s.title);
    if (s.intro) lines.push(s.intro);
    for (const g of s.groups ?? []) {
      if (g.label) lines.push(g.label);
      for (const item of g.items) lines.push(`- ${item}`);
    }
    lines.push("");
  }
  lines.push(
    "15. OUTSTANDING ITEMS / EXCEPTIONS",
    form.exceptions || "____________________________________________________________",
    "",
    "16. SIGNATURES",
    "The undersigned certify that they are authorized representatives of their respective parties and agree to the terms contained in this Agreement.",
    `Developer 1 Name: ${form.developerOne || "__________________________________________"}`,
    "Developer 1 Signature: __________________________________________",
    "Date: 17 August 2026",
    `Developer 2 Name: ${form.developerTwo || "__________________________________________"}`,
    "Developer 2 Signature: __________________________________________",
    "Date: 17 August 2026",
    `Client Name: ${form.clientSigner || "Mr Pride Tatire"}`,
    "Client Signature: __________________________________________",
    "Date: 17 August 2026",
    "",
    "CERTIFICATE OF COMPLETION",
    "The Developers hereby certify that the TillPoint Retail OS has been successfully designed, developed, deployed and formally handed over to the Client in accordance with the agreed project scope. The Client acknowledges receipt of the delivered software, associated operational workflows and system demonstration, subject only to any written exceptions recorded within this Agreement.",
    "",
    "Document Title: POS Software Development, Handover & Acceptance Agreement",
    "Project: TillPoint Retail OS",
    "Version: 3.0",
    "Status: Final",
    "Date: 17 August 2026",
  );
  return lines.join("\n");
}

function AgreementPage() {
  const [form, setForm] = useState(readAgreement);
  const update = (key: keyof typeof initial, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(form));
    toast.success("Agreement details saved on this device.");
  };

  const download = () => {
    const blob = new Blob([buildDocument(form)], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "TillPoint-Handover-Acceptance-Agreement-v3.doc";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-900 md:p-10">
      <header className="mx-auto mb-8 max-w-5xl text-white">
        <div className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
          <FileText className="h-4 w-4" /> Executive record - Version 3.0 - Final
        </div>
        <h1 className="max-w-4xl font-serif text-4xl font-semibold tracking-tight md:text-6xl">
          POS Software Development, Handover &amp; Acceptance Agreement
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
          TillPoint Retail OS - final handover and acceptance record dated 17 August 2026.
        </p>
      </header>

      <Card className="mx-auto max-w-5xl border-amber-200/70 bg-white p-6 shadow-2xl md:p-10">
        <h2 className="font-serif text-2xl font-semibold text-slate-950">Executive record</h2>
        <dl className="mt-4 divide-y divide-slate-200 border-y border-slate-200 text-sm">
          {RECORD.map(([k, v]) => (
            <div key={k} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[220px_1fr]">
              <dt className="font-medium text-slate-600">{k}</dt>
              <dd className="text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-800">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h3 className="font-serif text-lg font-semibold text-slate-950">{s.title}</h3>
              {s.intro && <p className="mt-2 text-slate-700">{s.intro}</p>}
              {(s.groups ?? []).map((g, gi) => (
                <div key={`${s.title}-${g.label ?? gi}`} className="mt-3">
                  {g.label && <div className="font-medium text-slate-900">{g.label}</div>}
                  <ul className="mt-1 list-disc space-y-1 pl-6 text-slate-700">
                    {g.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}

          <section>
            <h3 className="font-serif text-lg font-semibold text-slate-950">
              15. OUTSTANDING ITEMS / EXCEPTIONS
            </h3>
            <Textarea
              className="mt-2"
              rows={5}
              placeholder="Record any written exceptions here."
              value={form.exceptions}
              onChange={(e) => update("exceptions", e.target.value)}
            />
          </section>

          <section>
            <h3 className="font-serif text-lg font-semibold text-slate-950">16. SIGNATURES</h3>
            <p className="mt-2 text-slate-700">
              The undersigned certify that they are authorized representatives of their respective
              parties and agree to the terms contained in this Agreement.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Developer 1 name</Label>
                <Input
                  value={form.developerOne}
                  onChange={(e) => update("developerOne", e.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Signature: __________________ · Date: 17 August 2026
                </p>
              </div>
              <div>
                <Label>Developer 2 name</Label>
                <Input
                  value={form.developerTwo}
                  onChange={(e) => update("developerTwo", e.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Signature: __________________ · Date: 17 August 2026
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label>Client name</Label>
                <Input
                  value={form.clientSigner}
                  onChange={(e) => update("clientSigner", e.target.value)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Signature: __________________ · Date: 17 August 2026
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-6">
            <h3 className="font-serif text-lg font-semibold text-slate-950">
              CERTIFICATE OF COMPLETION
            </h3>
            <p className="mt-2 text-slate-700">
              The Developers hereby certify that the TillPoint Retail OS has been successfully
              designed, developed, deployed and formally handed over to the Client in accordance
              with the agreed project scope. The Client acknowledges receipt of the delivered
              software, associated operational workflows and system demonstration, subject only to
              any written exceptions recorded within this Agreement.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">
              Project: TillPoint Retail OS · Version 3.0 · Status: Final · 17 August 2026
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-6">
          <Button variant="outline" onClick={save}>
            <Save className="mr-2 h-4 w-4" /> Save details
          </Button>
          <Button onClick={download}>
            <Download className="mr-2 h-4 w-4" /> Download document
          </Button>
        </div>
      </Card>

      <HandoverReceipt />
    </div>
  );
}
