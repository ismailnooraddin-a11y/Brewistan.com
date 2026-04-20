import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const { data: cafe } = await supabase
    .from("cafes")
    .select("name, city")
    .eq("merchant_id", user.id)
    .maybeSingle();

  const firstName =
    (merchant?.full_name ?? user.user_metadata?.full_name ?? "")
      .toString()
      .split(" ")[0] || "there";

  const cafeName =
    cafe?.name ?? user.user_metadata?.cafe_name ?? "Your café";

  const cafeCity = cafe?.city ?? user.user_metadata?.city ?? "";

  return (
    <div className="min-h-screen bg-paper">
      <Header authed />

      <main className="container-pad py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Dashboard
          </p>
          <h1 className="mt-2 text-display text-ink">
            Welcome, {firstName}.
          </h1>
          <p className="mt-2 text-[16px] text-ink-soft">
            Your account is ready. Next up: set up your loyalty program.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoCard
              label="Your café"
              value={cafeName}
              secondary={cafeCity}
            />
            <InfoCard
              label="Signed in as"
              value={user.email ?? ""}
              secondary={merchant?.phone ?? user.user_metadata?.phone ?? ""}
            />
          </div>

          <div className="mt-10">
            <h2 className="text-h2 text-ink">What&rsquo;s next</h2>
            <div className="mt-4 space-y-3">
              <Step
                n="1"
                title="Design your reward"
                body="Pick how many stamps earn a free coffee, and what the reward is."
                status="Coming soon"
              />
              <Step
                n="2"
                title="Display your QR at the counter"
                body="A rotating QR code that customers scan to collect stamps."
                status="Coming soon"
              />
              <Step
                n="3"
                title="Invite your team"
                body="Give your baristas access so they can confirm redemptions."
                status="Coming soon"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoCard({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1.5 text-[16px] font-semibold tracking-tight text-ink">
        {value}
      </p>
      {secondary && (
        <p className="mt-0.5 text-[13px] text-ink-soft">{secondary}</p>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  body,
  status,
}: {
  n: string;
  title: string;
  body: string;
  status: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-[13px] font-medium text-ink-soft">
        {n}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">
            {title}
          </h3>
          <span className="shrink-0 rounded-full bg-paper-tint px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">
            {status}
          </span>
        </div>
        <p className="mt-1 text-[14px] leading-[1.55] text-ink-soft">{body}</p>
      </div>
    </div>
  );
}
