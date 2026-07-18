"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileCheck2, FileUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { removeResumePdf, saveResumeText, uploadResumePdf } from "@/app/actions/profile";

export function ResumeCard({
  rawText,
  resumeFileName,
}: {
  rawText: string;
  resumeFileName: string | null;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(rawText);
  const [pending, startTransition] = useTransition();

  function handleUpload(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const res = await uploadResumePdf(formData);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resume</CardTitle>
        <CardDescription>
          Upload a PDF (parsed and attached to outgoing emails) or paste plain text.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pdf">
          <TabsList>
            <TabsTrigger value="pdf">PDF upload</TabsTrigger>
            <TabsTrigger value="text">Plain text</TabsTrigger>
          </TabsList>

          <TabsContent value="pdf" className="mt-4">
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            {resumeFileName ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileCheck2 className="size-5 text-primary" />
                  <div>
                    <p className="font-mono text-sm">{resumeFileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {rawText.length.toLocaleString()} characters parsed — attached to every send
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => fileInput.current?.click()}
                  >
                    Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await removeResumePdf();
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.error);
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => fileInput.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed px-6 py-10 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                {pending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <FileUp className="size-5" />
                )}
                {pending ? "Parsing PDF…" : "Click to upload your resume (PDF, max 2 MB)"}
              </button>
            )}
          </TabsContent>

          <TabsContent value="text" className="mt-4 flex flex-col gap-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Paste the full text of your resume here…"
              className="font-mono text-xs"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {text.length.toLocaleString()} characters
              </p>
              <Button
                size="sm"
                disabled={pending || text.trim() === rawText.trim()}
                onClick={() =>
                  startTransition(async () => {
                    const res = await saveResumeText(text);
                    if (res.ok) toast.success(res.message);
                    else toast.error(res.error);
                  })
                }
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Save resume text
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
