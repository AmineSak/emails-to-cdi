import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/singletons";
import { ResumeCard } from "@/components/profile/resume-card";
import { PreferencesForm } from "@/components/profile/preferences-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await getProfile();
  // Never ship the PDF bytes to the client — only metadata
  const profile = await prisma.resumeProfile.findUniqueOrThrow({
    where: { id: "singleton" },
    select: {
      rawText: true,
      resumeFileName: true,
      targetRoles: true,
      industries: true,
      locations: true,
      tone: true,
      achievements: true,
      availability: true,
      extraContext: true,
      updatedAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Resume &amp; Preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything here is injected into every generated email — the more specific, the less
          templated the result.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <ResumeCard
          rawText={profile.rawText}
          resumeFileName={profile.resumeFileName}
        />
        <PreferencesForm
          initial={{
            targetRoles: profile.targetRoles,
            industries: profile.industries,
            locations: profile.locations,
            tone: profile.tone,
            achievements: profile.achievements,
            availability: profile.availability,
            extraContext: profile.extraContext,
          }}
        />
      </div>
    </div>
  );
}
