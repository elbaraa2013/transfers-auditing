import { Resend } from "resend";

interface ResendCredentials {
  apiKey: string;
  fromEmail?: string;
}

async function getCredentials(): Promise<ResendCredentials> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Resend connector is not available in this environment");
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    },
  );

  const data = (await response.json()) as {
    items?: { settings?: Record<string, string> }[];
  };
  const settings = data.items?.[0]?.settings;
  const apiKey = settings?.api_key;

  if (!apiKey) {
    throw new Error("Resend connection is not configured");
  }

  return { apiKey, fromEmail: settings?.from_email };
}

export async function getResendClient(): Promise<{
  client: Resend;
  fromEmail: string;
}> {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: fromEmail || "onboarding@resend.dev",
  };
}
