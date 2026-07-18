"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { savePreferences } from "@/app/actions/profile";

type Prefs = {
  targetRoles: string;
  industries: string;
  locations: string;
  tone: string;
  achievements: string;
  availability: string;
  extraContext: string;
};

const TONES = [
  { value: "formel", label: "Formal (vouvoiement, sober)" },
  { value: "professionnel direct", label: "Direct professional" },
  { value: "chaleureux mais professionnel", label: "Warm but professional" },
];

export function PreferencesForm({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof Prefs) => (value: string) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          Target, tone and constraints used to steer every generated email.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="targetRoles">Target job titles</Label>
            <Input
              id="targetRoles"
              value={prefs.targetRoles}
              onChange={(e) => set("targetRoles")(e.target.value)}
              placeholder="e.g. Data Engineer, Analytics Engineer"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="industries">Target industries</Label>
            <Input
              id="industries"
              value={prefs.industries}
              onChange={(e) => set("industries")(e.target.value)}
              placeholder="e.g. fintech, energy, retail"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="locations">Locations</Label>
            <Input
              id="locations"
              value={prefs.locations}
              onChange={(e) => set("locations")(e.target.value)}
              placeholder="e.g. Paris, Lyon, full remote"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Tone</Label>
            <Select
              items={Object.fromEntries(TONES.map((t) => [t.value, t.label]))}
              value={prefs.tone}
              onValueChange={(v) => set("tone")(v ?? "formel")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a tone" />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="availability">Availability / notice period</Label>
            <Input
              id="availability"
              value={prefs.availability}
              onChange={(e) => set("availability")(e.target.value)}
              placeholder="e.g. available immediately, 1 month notice"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="achievements">Key achievements to emphasize</Label>
          <Textarea
            id="achievements"
            value={prefs.achievements}
            onChange={(e) => set("achievements")(e.target.value)}
            rows={3}
            placeholder="One per line — concrete, quantified results work best"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="extraContext">Anything else the AI should know</Label>
          <Textarea
            id="extraContext"
            value={prefs.extraContext}
            onChange={(e) => set("extraContext")(e.target.value)}
            rows={2}
            placeholder="e.g. salary expectations, visa status, do not mention X…"
          />
        </div>

        <div className="flex justify-end">
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await savePreferences(prefs);
                if (res.ok) toast.success(res.message);
                else toast.error(res.error);
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
