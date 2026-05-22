import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GOATSaaS Docs — API & SDK Reference",
  description:
    "Complete reference for the GOATSaaS REST API and JavaScript/TypeScript SDK. Authenticate with API keys, run NL→SQL queries, stream anomaly alerts, register webhooks, and more.",
  openGraph: {
    title: "GOATSaaS Docs",
    description: "API & SDK Reference for GOATSaaS",
    type: "website",
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
