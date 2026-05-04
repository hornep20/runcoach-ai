import Link from "next/link";

export default function Home() {
  const featureLinks = [
    {
      href: "/dashboard",
      title: "Running Dashboard",
      description: "View training load, key metrics, and recent run history.",
    },
    {
      href: "/calendar",
      title: "Training Calendar",
      description: "See your scheduled workouts and weekly structure.",
    },
    {
      href: "/plans/base-building",
      title: "Base-Building Plan",
      description: "Create progressive base mileage blocks.",
    },
    {
      href: "/plans/marathon",
      title: "16-Week Marathon Plan",
      description: "Generate a goal-paced marathon cycle.",
    },
    {
      href: "/strength",
      title: "Strength & Mobility",
      description: "Add complementary workouts for durability.",
    },
    {
      href: "/coach",
      title: "AI Coach",
      description: "Get personalized coaching recommendations.",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-zinc-500">Marathon coaching platform</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Train smarter with RunCoach AI
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600">
          Build structured marathon plans, sync training data, and get clear next-step coaching
          guidance in one place.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {featureLinks.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300"
          >
            <h2 className="text-lg font-semibold">{feature.title}</h2>
            <p className="mt-1 text-sm text-zinc-600">{feature.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
