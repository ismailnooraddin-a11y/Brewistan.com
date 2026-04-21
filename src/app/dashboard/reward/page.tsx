import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import RewardForm from "./RewardForm";

export default async function RewardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const { data: cafe } = await supabase
    .from("cafes")
    .select("id, name")
    .eq("merchant_id", user.id)
    .maybeSingle();

  if (!cafe) {
    redirect("/dashboard");
  }

  const { data: reward } = await supabase
    .from("rewards")
    .select("id, stamps_required, reward_text, is_active, configured_at")
    .eq("cafe_id", cafe.id)
    .maybeSingle();

  return (
    <div className="min-h-screen">
      <Header authed />

      <main className="container-pad py-10 sm:py-14">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ember"
          >
            <span
              aria-hidden
              className="inline-block transition-transform duration-200 ease-enter group-hover:-translate-x-0.5"
            >
              ←
            </span>
            Back to dashboard
          </Link>

          <div className="mt-6 animate-fade-up">
            <span className="eyebrow">Step 01</span>
            <h1 className="mt-4 text-display text-ink">
              Design your{" "}
              <span className="display-serif text-ember">reward</span>
            </h1>
            <p className="mt-3 max-w-xl text-[16px] text-ink-soft">
              Pick how many stamps earn a free drink, and what the reward
              is. You can change this anytime.
            </p>
          </div>

          <RewardForm
            cafeId={cafe.id}
            cafeName={cafe.name}
            initialStamps={reward?.stamps_required ?? 8}
            initialRewardText={reward?.reward_text ?? "Free coffee"}
            initialActive={reward?.is_active ?? true}
            alreadyConfigured={Boolean(reward?.configured_at)}
          />
        </div>
      </main>
    </div>
  );
}
