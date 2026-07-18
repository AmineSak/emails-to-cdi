"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FlaskConical, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateSelfTestDraft, sendSelfTestEmail } from "@/app/actions/dev";

export function DevTestEmailCard({
  gmailConnected,
  gmailEmail,
}: {
  gmailConnected: boolean;
  gmailEmail: string | null;
}) {
  const [testCompany, setTestCompany] = useState("");
  const [testJobTitle, setTestJobTitle] = useState("");
  const [subject, setSubject] = useState("Test");
  const [body, setBody] = useState("Ceci est un e-mail de test.");
  const [pending, startTransition] = useTransition();
  const [genPending, startGenTransition] = useTransition();

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-muted-foreground" />
          Dev: send a test email to yourself
        </CardTitle>
        <CardDescription>
          Exercises the real Gmail send path without creating a lead or draft — including
          attaching your resume PDF, if one is on file. Only visible in development, and only ever
          sends to{" "}
          {gmailEmail ? <span className="font-mono">{gmailEmail}</span> : "your connected account"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dev-test-company">Test company (optional)</Label>
            <Input
              id="dev-test-company"
              value={testCompany}
              onChange={(e) => setTestCompany(e.target.value)}
              placeholder="Entreprise Test"
              disabled={genPending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dev-test-job-title">Test job title (optional)</Label>
            <Input
              id="dev-test-job-title"
              value={testJobTitle}
              onChange={(e) => setTestJobTitle(e.target.value)}
              placeholder="Recruteur"
              disabled={genPending}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dev-test-subject">Subject</Label>
          <Input
            id="dev-test-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dev-test-body">Body</Label>
          <Textarea
            id="dev-test-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            disabled={pending}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={genPending}
            onClick={() =>
              startGenTransition(async () => {
                const res = await generateSelfTestDraft(testCompany, testJobTitle);
                if (res.ok && res.subject && res.body) {
                  setSubject(res.subject);
                  setBody(res.body);
                  toast.success("Draft generated");
                } else if (!res.ok) toast.error(res.error);
              })
            }
          >
            {genPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Generate with AI
          </Button>
          <Button
            size="sm"
            disabled={pending || !gmailConnected}
            title={gmailConnected ? undefined : "Connect Gmail first"}
            onClick={() =>
              startTransition(async () => {
                const res = await sendSelfTestEmail(subject, body);
                if (res.ok) toast.success(res.message);
                else toast.error(res.error);
              })
            }
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send to myself
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
