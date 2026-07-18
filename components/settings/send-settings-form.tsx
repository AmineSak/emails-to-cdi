"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSendSettings } from "@/app/actions/settings";

type Values = {
  sendDelaySeconds: number;
  dailySendCap: number;
  geminiModel: string;
};

export function SendSettingsForm({
  initial,
  geminiEnvReady,
}: {
  initial: Values;
  geminiEnvReady: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sending &amp; generation</CardTitle>
        <CardDescription>
          Guardrails against Gmail throttling — the daily cap is enforced server-side.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="delay">Delay between sends (s)</Label>
            <Input
              id="delay"
              type="number"
              min={5}
              max={3600}
              value={values.sendDelaySeconds}
              onChange={(e) =>
                setValues((v) => ({ ...v, sendDelaySeconds: Number(e.target.value) }))
              }
            />
            <p className="text-xs text-muted-foreground">30–60s recommended (a little jitter is added).</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cap">Daily send cap</Label>
            <Input
              id="cap"
              type="number"
              min={1}
              max={500}
              value={values.dailySendCap}
              onChange={(e) => setValues((v) => ({ ...v, dailySendCap: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">Queued emails beyond the cap wait until tomorrow.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="model">Gemini model</Label>
            <Input
              id="model"
              value={values.geminiModel}
              onChange={(e) => setValues((v) => ({ ...v, geminiModel: e.target.value }))}
              className="font-mono text-xs"
            />
            {!geminiEnvReady && (
              <p className="text-xs text-amber-800">GEMINI_API_KEY is not set — generation will fail.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await saveSendSettings(values);
                if (res.ok) toast.success(res.message);
                else toast.error(res.error);
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
