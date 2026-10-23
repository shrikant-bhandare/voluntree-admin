"use client";

import { useEffect } from "react";
import { Leaf } from "lucide-react";
import { SessionProvider, useSession } from "../lib/session";
import { FeedbackProvider } from "../lib/feedback";
import { ConsoleProvider, useConsole } from "../components/shell/ConsoleContext";
import { AppShell } from "../components/shell/AppShell";
import { SignIn } from "../components/shell/SignIn";
import { Inspector } from "../components/inspectors/Inspector";
import { viewLabel } from "../components/shell/nav";
import { VIEWS } from "../views";

function Console() {
  const { view } = useConsole();
  const View = VIEWS[view];

  useEffect(() => {
    document.title = `${viewLabel(view)} · Voluntree Admin`;
  }, [view]);

  return (
    <AppShell>
      {/* Keyed so each screen starts fresh (filters, scroll) when you arrive. */}
      <div key={view} className="enter-up">
        <View />
      </div>
      <Inspector />
    </AppShell>
  );
}

function Gate() {
  const { ready, token } = useSession();
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading the console">
        <span className="inline-flex size-12 animate-pulse items-center justify-center rounded-xl bg-forest text-mint">
          <Leaf aria-hidden className="size-6" />
        </span>
      </div>
    );
  }
  if (!token) return <SignIn />;
  return (
    <ConsoleProvider>
      <Console />
    </ConsoleProvider>
  );
}

export default function AdminConsolePage() {
  return (
    <SessionProvider>
      <FeedbackProvider>
        <Gate />
      </FeedbackProvider>
    </SessionProvider>
  );
}
