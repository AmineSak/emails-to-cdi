import { GoogleGenAI, Type } from "@google/genai";
import type { Lead, ResumeProfile } from "@prisma/client";

export type GeneratedDraft = { subject: string; body: string; model: string };

function buildPrompt(profile: ResumeProfile, lead: Lead, adjust?: string): string {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  const parts = [
    `Tu rédiges un e-mail de candidature spontanée en français pour un poste en CDI.`,
    ``,
    `## Mon profil (CV)`,
    profile.rawText || "(CV non fourni)",
    ``,
    `## Mes préférences`,
    profile.targetRoles && `Postes visés : ${profile.targetRoles}`,
    profile.industries && `Secteurs visés : ${profile.industries}`,
    profile.locations && `Localisations : ${profile.locations}`,
    profile.achievements && `Réalisations à mettre en avant : ${profile.achievements}`,
    profile.availability && `Disponibilité : ${profile.availability}`,
    profile.extraContext && `Contexte supplémentaire : ${profile.extraContext}`,
    `Ton souhaité : ${profile.tone || "professionnel"}`,
    ``,
    `## Destinataire`,
    fullName && `Nom : ${fullName}`,
    lead.jobTitle && `Poste : ${lead.jobTitle}`,
    lead.companyName && `Entreprise : ${lead.companyName}`,
    lead.companyIndustry && `Secteur : ${lead.companyIndustry}`,
    ``,
    `## Consignes`,
    `- E-mail court (150 à 220 mots maximum), personnalisé, jamais générique ni templaté.`,
    `- Fais naturellement référence au poste du destinataire, à son entreprise et à son secteur.`,
    `- Relie explicitement 1 ou 2 éléments concrets de mon profil aux besoins probables de cette entreprise.`,
    `- Aucune phrase de remplissage ("je me permets de vous contacter", "n'hésitez pas", etc.).`,
    `- Termine par un appel à l'action clair (proposition d'échange téléphonique ou de rencontre).`,
    `- Objet d'e-mail court et spécifique (pas de "Candidature spontanée" seul).`,
    `- Le corps se termine par une signature avec mon prénom et nom (déduits du CV).`,
    `- N'invente aucun fait qui ne figure pas dans mon profil.`,
    adjust && ``,
    adjust && `## Ajustement demandé`,
    adjust && adjust,
  ];
  return parts.filter((p): p is string => typeof p === "string").join("\n");
}

export async function generateEmail(
  profile: ResumeProfile,
  lead: Lead,
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
