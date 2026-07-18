import { GoogleGenAI, Type } from "@google/genai";
import type { Lead, ResumeProfile } from "@prisma/client";

export type GeneratedDraft = { subject: string; body: string; model: string };

// Only these fields ever feed the prompt, so callers without a real Lead row
// (e.g. the dev test-email tool) can pass a plain literal instead.
export type LeadContext = Pick<Lead, "firstName" | "lastName" | "jobTitle" | "companyName" | "companyIndustry">;

function buildPrompt(profile: ResumeProfile, lead: LeadContext, adjust?: string): string {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ");

  const parts = [
    `Tu es un candidat expérimenté qui écrit lui-même un e-mail de candidature spontanée en français pour un poste en CDI.`,
    `Ton objectif est d'obtenir une réponse, pas d'impressionner.`,
    `Le résultat doit être impossible à distinguer d'un e-mail écrit par une personne.`,
    ``,

    `# Informations sur le candidat`,
    `## CV`,
    profile.rawText || "(CV non fourni)",
    ``,

    `## Préférences`,
    profile.targetRoles && `Postes visés : ${profile.targetRoles}`,
    profile.industries && `Secteurs : ${profile.industries}`,
    profile.locations && `Localisations : ${profile.locations}`,
    profile.achievements && `Réalisations importantes : ${profile.achievements}`,
    profile.availability && `Disponibilité : ${profile.availability}`,
    profile.extraContext && `Contexte : ${profile.extraContext}`,
    `Ton souhaité : ${profile.tone || "professionnel"}`,
    ``,

    `# Destinataire`,
    fullName && `Nom : ${fullName}`,
    lead.jobTitle && `Poste : ${lead.jobTitle}`,
    lead.companyName && `Entreprise : ${lead.companyName}`,
    lead.companyIndustry && `Secteur : ${lead.companyIndustry}`,
    ``,

    `# Mission`,
    `Rédige :`,
    `- un objet`,
    `- un e-mail`,
    ``,

    `# Contraintes`,
    `- Entre 100 et 170 mots.`,
    `- Le mail doit sembler écrit à la main.`,
    `- Style simple, fluide, naturel.`,
    `- Ne ressemble jamais à une lettre de motivation classique.`,
    `- Utilise des phrases de longueur variable.`,
    `- Privilégie un ton direct et humain.`,
    ``,

    `# Personnalisation`,
    `- Fais naturellement référence au nom de l'entreprise, à son secteur ou éventuellement au poste du destinataire.`,
    `- La personnalisation doit rester légère et crédible.`,
    `- Ne décris jamais le métier du destinataire.`,
    `- Ne suppose jamais les enjeux de l'entreprise.`,
    `- Ne fais jamais semblant de connaître sa stratégie, son organisation ou ses projets internes.`,
    `- N'utilise pas LinkedIn comme une description de poste.`,
    ``,

    `# Mise en valeur du profil`,
    `- Choisis uniquement 1 ou 2 éléments forts du CV.`,
    `- Explique-les naturellement.`,
    `- Ne récite jamais le CV.`,
    `- Ne fais pas une liste de compétences.`,
    `- N'invente aucun fait absent du CV.`,
    ``,

    `# Expressions interdites`,
    `N'utilise jamais les formulations suivantes :`,
    `"En tant que..."`,
    `"Vous pilotez..."`,
    `"Vous êtes responsable de..."`,
    `"Vos enjeux..."`,
    `"Votre expertise..."`,
    `"Votre leadership..."`,
    `"Je me permets de..."`,
    `"Je suis convaincu que..."`,
    `"Mon profil correspond parfaitement..."`,
    `"Fort de..."`,
    `"Dans le cadre de..."`,
    `"Au regard de..."`,
    `"Capitaliser"`,
    `"Mettre à profit"`,
    `"Valoriser"`,
    `"Synergie"`,
    `"Levier"`,
    `"Transformation"`,
    ``,

    `# Conclusion`,
    `- Termine par une proposition simple d'échange.`,
    `- Exemple : "Si mon profil vous semble pertinent, je serais heureux d'en discuter quelques minutes."`,
    `- Termine uniquement par la signature avec le prénom et le nom déduits du CV.`,
    ``,

    `# Vérification avant de répondre`,
    `Avant de produire le mail, imagine que le destinataire reçoit plus de 100 candidatures par semaine.`,
    `Supprime toute phrase qui pourrait être copiée dans un autre e-mail sans que personne ne s'en aperçoive.`,
    `Chaque phrase doit apporter une information concrète sur le candidat ou expliquer naturellement pourquoi cette entreprise a été choisie.`,
    `Si une phrase ressemble à une lettre de motivation générée par une IA, réécris-la.`,
    ``,

    `# Exemple de style à suivre`,
    `Objet : IA appliquée chez Voltaire Energie`,
    ``,
    `Bonjour Madame Martin,`,
    ``,
    `Je vous écris car les projets menés chez Voltaire Energie correspondent au type d'environnement dans lequel j'aimerais poursuivre ma carrière.`,
    ``,
    `Je travaille aujourd'hui sur des applications d'IA générative et de traitement de données, avec notamment le développement de solutions RAG et l'optimisation de pipelines de données. Ce sont des sujets sur lesquels j'aime intervenir, aussi bien sur la partie technique que sur la mise en production.`,
    ``,
    `Je ne sais pas si vous recrutez actuellement sur ce type de profil, mais si mon parcours peut vous intéresser, je serais heureux d'échanger quelques minutes avec vous.`,
    ``,
    `Bien à vous,`,
    `Amine Sakouhi`,
    ``,

    adjust && `# Ajustement demandé`,
    adjust && adjust,
  ];

  return parts
    .filter((p): p is string => typeof p === "string")
    .join("\n");
}

export async function generateEmail(
  profile: ResumeProfile,
  lead: LeadContext,
  model: string,
  adjust?: string,
): Promise<GeneratedDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set — add it in Settings/env.");
  const ai = new GoogleGenAI({ apiKey });

  const res = await ai.models.generateContent({
    model,
    contents: buildPrompt(profile, lead, adjust),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          body: { type: Type.STRING },
        },
        required: ["subject", "body"],
      },
    },
  });

  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty response");
  let parsed: { subject?: string; body?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned unparseable output — try again");
  }
  if (!parsed.subject || !parsed.body) {
    throw new Error("Gemini response is missing subject or body — try again");
  }
  return { subject: parsed.subject.trim(), body: parsed.body.trim(), model };
}
