import { redirect } from "next/navigation";
import Link from "next/link";
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
    .select("id, name, city")
    .eq("merchant_id", user.id)
    .maybeSingle();

  const { data: reward } = cafe
    ? await supabase
        .from("rewards")
        .select("stamps_required, reward_text, is_active, configured_at")
        .eq("cafe_id", cafe.id)
        .maybeSingle()
    : { data: null };

  const firstName =
    (merchant?.full_name ?? user.user_metadata?.full_name ?? "")
      .toString()
      .split(" ")[0] || "there";

  const cafeName =
    cafe?.name ?? user.user_metadata?.cafe_name ?? "Your café";

  const cafeCity = cafe?.city ?? user.user_metadata?.city ?? "";

  const rewardConfigured = Boolean(reward?.configured_at);

  return (
    <div className="min-h-screen">
      <Header authed />

      <main className="container-pad py-10 sm:py-16">
        <div className="mx-auto max-w-4xl">
          {/* Greeting */}
          <div className="animate-fade-up">
            <span className="eyebrow">Dashboard</span>
            <h1 className="mt-4 text-display text-ink">
              Welcome,{" "}
              <span className="display-serif text-ember">
                {firstName}
                <span className="animate-blink">.</span>
              </span>
            </h1>
            <p className="mt-3 text-[16px] text-ink-soft">
              {rewardConfigured
                ? "Your reward is live. Next up: launch your QR code."
                : "Your account is ready. Next up: set up your loyalty program."}
            </p>
          </div>

          {/* Info cards */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="stagger-child">
              <InfoCard
                label="Your café"
                value={cafeName}
                secondary={cafeCity}
                icon={<IconStore />}
              />
            </div>
            <div className="stagger-child">
              <InfoCard
                label="Signed in as"
                value={user.email ?? ""}
                secondary={merchant?.phone ?? user.user_metadata?.phone ?? ""}
                icon={<IconKey />}
              />
            </div>
          </div>

          {/* Reward summary (shown only after configuration) */}
          {rewardConfigured && reward && (
            <div className="mt-10 animate-fade-up rounded-2xl border border-ember/30 bg-ember/5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ember">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12 l4 4 l10 -10" />
                    </svg>
                    Reward live
                  </p>
                  <p className="mt-2 text-[17px] font-medium text-ink">
                    Buy{" "}
                    <span className="display-serif text-ember">
                      {reward.stamps_required}
                    </span>
                    , get {reward.reward_text.toLowerCase()}
                  </p>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    {reward.is_active
                      ? "Active — customers can earn stamps."
                      : "Paused — resume anytime."}
                  </p>
                </div>
                <Link
                  href="/dashboard/reward"
                  className="btn-secondary !py-2 !px-4 !text-[13px]"
                >
                  Edit
                </Link>
              </div>
            </div>
          )}

          {/* Next steps */}
          <div className="mt-14">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-h2 text-ink">
                What&rsquo;s{" "}
                <span className="display-serif text-ember">next</span>
              </h2>
              <p className="text-[13px] text-ink-muted">
                {rewardConfigured ? "1 of 3 complete" : "3 steps to launch"}
              </p>
            </div>

            <div className="space-y-3">
              <div className="stagger-child">
                <StepRow
                  n="01"
                  title="Design your reward"
                  body="Pick how many stamps earn a free coffee, and what the reward is."
                  status={rewardConfigured ? "Completed" : "Active"}
                  completed={rewardConfigured}
                  href="/dashboard/reward"
                />
              </div>
              <div className="stagger-child">
                <StepRow
                  n="02"
                  title="Display your QR at the counter"
                  body="A rotating QR code that customers scan to collect stamps."
                  status="Coming soon"
                />
              </div>
              <div className="stagger-child">
                <StepRow
                  n="03"
                  title="Invite your team"
                  body="Give your baristas access so they can confirm redemptions."
                  status="Coming soon"
                />
              </div>
            </div>
          </div>

          {/* Tip strip */}
          <div className="mt-12 flex flex-col items-start gap-3 rounded-2xl border border-line bg-paper-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ember/15 text-ember">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 v2" />
                  <path d="M12 20 v2" />
                  <path d="M4.93 4.93 l1.41 1.41" />
                  <path d="M17.66 17.66 l1.41 1.41" />
                  <path d="M2 12 h2" />
                  <path d="M20 12 h2" />
                  <circle cx="12" cy="12" r="5" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-medium text-ink">
                  While you wait
                </p>
                <p className="text-[13px] text-ink-soft">
                  We&rsquo;re brewing the rest of your dashboard. You&rsquo;ll
                  get an email the moment it pours.
                </p>
              </div>
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
  icon,
}: {
  label: string;
  value: string;
  secondary?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card-hoverable group">
      <div className="flex items-start gap-4">
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper-tint text-ember transition-colors duration-200 group-hover:bg-ember group-hover:text-paper">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            {label}
          </p>
          <p className="mt-1.5 truncate text-[16px] font-semibold tracking-tight text-ink">
            {value}
          </p>
          {secondary && (
            <p className="mt-0.5 truncate text-[13px] text-ink-soft">
              {secondary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StepRow({
  n,
  title,
  body,
  status,
  completed = false,
  href,
}: {
  n: string;
  title: string;
  body: string;
  status: string;
  completed?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={`group flex items-start gap-5 rounded-2xl border p-5 transition-all duration-300 ease-enter ${
        href
          ? "cursor-pointer border-line bg-paper-card hover:-translate-y-0.5 hover:border-ember/50 hover:shadow-lift"
          : "border-line bg-paper-card"
      }`}
    >
      <div
        className={`pt-0.5 transition-colors duration-200 ${
          completed
            ? ""
            : "display-serif text-[28px] leading-none text-ember/50 group-hover:text-ember"
        }`}
      >
        {completed ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ember text-paper">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12 l4 4 l10 -10" />
            </svg>
          </span>
        ) : (
          n
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">
            {title}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              completed
                ? "border border-ember/30 bg-ember/10 text-ember"
                : status === "Active"
                ? "border border-ember bg-ember text-paper"
                : "border border-line bg-paper-tint text-ink-muted"
            }`}
          >
            {status}
          </span>
        </div>
        <p className="mt-1.5 text-[14px] leading-[1.55] text-ink-soft">
          {body}
        </p>
      </div>
      {href && (
        <span
          aria-hidden
          className="mt-1 text-ink-faint transition-all duration-200 ease-enter group-hover:translate-x-0.5 group-hover:text-ember"
        >
          →
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

function IconStore() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 l2 -5 h14 l2 5" />
      <path d="M3 9 v11 h18 v-11" />
      <path d="M3 9 a3 3 0 0 0 6 0 a3 3 0 0 0 6 0 a3 3 0 0 0 6 0" />
    </svg>
  );
}
function IconKey() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12 h9" />
      <path d="M17 12 v3" />
      <path d="M21 12 v2" />
    </svg>
  );
}
