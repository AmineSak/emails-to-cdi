"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LeadStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  Building2,
  ExternalLink,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { LeadDTO } from "@/lib/lead-dto";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/leads/status-badge";
import { generateDraft, updateDraft } from "@/app/actions/drafts";
import { saveNotes, setLeadStatus } from "@/app/actions/leads";
import { cancelQueued } from "@/app/actions/send";

const QUICK_ADJUSTS = [
  { label: "Shorter", instruction: "Raccourcis nettement l'e-mail (100 à 130 mots maximum)." },
  { label: "More formal", instruction: "Rends le ton plus formel et institutionnel." },
  { label: "More direct", instruction: "Rends l'e-mail plus direct : va droit au but dès la première phrase." },
];

export function LeadDrawer({
  lead,
  gmailConnected,
  onClose,
  onRequestSend,
}: {
  lead: LeadDTO | null;
  gmailConnected: boolean;
  onClose: () => void;
  onRequestSend: (leadIds: string[]) => void;
}) {
  return (
    <Sheet open={lead !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        {lead && (
          <DrawerBody
            key={lead.id}
            lead={lead}
            gmailConnected={gmailConnected}
            onRequestSend={onRequestSend}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  lead,
  gmailConnected,
  onRequestSend,
}: {
  lead: LeadDTO;
  gmailConnected: boolean;
  onRequestSend: (leadIds: string[]) => void;
}) {
  const router = useRouter();
  const name = `${lead.firstName} ${lead.lastName}`.trim() || lead.email;
  const [notes, setNotes] = useState(lead.notes);
  const [notesPending, startNotes] = useTransition();
  const [statusPending, startStatus] = useTransition();

  return (
    <>
      <SheetHeader className="gap-1 pr-10">
        <SheetTitle className="text-lg">{name}</SheetTitle>
        <SheetDescription className="flex flex-col gap-0.5 text-left">
          <span className="flex items-center gap-1.5 font-mono text-xs">
            <Mail className="size-3" /> {lead.email}
          </span>
          {(lead.jobTitle || lead.companyName) && (
            <span className="flex items-center gap-1.5 text-xs">
              <Building2 className="size-3" />
              {[lead.jobTitle, lead.companyName].filter(Boolean).join(" · ")}
              {lead.companyIndustry && ` (${lead.companyIndustry})`}
            </span>
          )}
          {lead.linkedinUrl && (
            <a
              href={lead.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline"
            >
              <ExternalLink className="size-3" /> LinkedIn profile
            </a>
          )}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 px-4 pb-6">
        <div className="flex items-center gap-3">
          <StatusBadge status={lead.status} />
          <Select
            items={Object.fromEntries(STATUS_ORDER.map((s) => [s, STATUS_META[s].label]))}
            value={lead.status}
            onValueChange={(v) => {
              if (!v || v === lead.status) return;
              startStatus(async () => {
                const res = await setLeadStatus(lead.id, v as LeadStatus);
                if (res.ok) {
                  toast.success(`Status set to ${STATUS_META[v as LeadStatus].label}`);
                  router.refresh();
                } else toast.error(res.error);
              });
            }}
          >
            <SelectTrigger size="sm" className="ml-auto" disabled={statusPending}>
              <SelectValue placeholder="Change status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(lead.lastContactedAt || lead.lastRepliedAt) && (
          <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/40 px-3 py-2.5">
            <div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Sent</p>
              <p className="font-mono text-xs">{formatDateTime(lead.lastContactedAt)}</p>
            </div>
            <div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Replied</p>
              <p className="font-mono text-xs">{formatDateTime(lead.lastRepliedAt)}</p>
            </div>
          </div>
        )}

        {lead.replySnippet && (
          <div className="rounded-md border border-teal-700/20 bg-teal-600/5 px-3 py-2.5">
            <p className="text-[10px] tracking-widest text-teal-800 uppercase">Latest reply</p>
            <p className="mt-1 text-sm text-foreground/90 italic">“{lead.replySnippet}”</p>
          </div>
        )}

        <Separator />

        <DraftSection
          key={lead.draft?.generatedAt ?? "no-draft"}
          lead={lead}
          gmailConnected={gmailConnected}
          onRequestSend={onRequestSend}
        />

        <Separator />

        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anything worth remembering about this contact…"
          />
          {notes !== lead.notes && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={notesPending}
                onClick={() =>
                  startNotes(async () => {
                    const res = await saveNotes(lead.id, notes);
                    if (res.ok) toast.success("Notes saved");
                    else toast.error(res.error);
                  })
                }
              >
                {notesPending && <Loader2 className="size-3.5 animate-spin" />}
                Save notes
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DraftSection({
  lead,
  gmailConnected,
  onRequestSend,
}: {
  lead: LeadDTO;
  gmailConnected: boolean;
  onRequestSend: (leadIds: string[]) => void;
}) {
  const router = useRouter();
  const draft = lead.draft;
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [genPending, startGen] = useTransition();
  const [savePending, startSave] = useTransition();

  const edited = draft !== null && (subject !== draft.subject || body !== draft.body);
  const canSend = ["DRAFTED", "NO_RESPONSE"].includes(lead.status) && draft !== null;

  function regenerate(adjust?: string) {
    startGen(async () => {
      const res = await generateDraft(lead.id, adjust);
      if (res.ok) {
        toast.success(adjust ? "Draft adjusted" : "Draft generated");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (!draft) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-dashed px-4 py-8 text-center">
        <Sparkles className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No draft yet. Generate a personalized candidature spontanée for {lead.companyName || "this lead"}.
        </p>
        <Button size="sm" disabled={genPending} onClick={() => regenerate()}>
          {genPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {genPending ? "Generating…" : "Generate draft"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Email draft</p>
        <p className="font-mono text-[10px] text-muted-foreground">
          {draft.model} · {formatDateTime(draft.generatedAt)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="draft-subject">Subject</Label>
        <Input
          id="draft-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={genPending}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="draft-body">Body</Label>
        <Textarea
          id="draft-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          disabled={genPending}
          className="text-sm leading-relaxed"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={genPending}
          onClick={() => regenerate()}
        >
          {genPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          Regenerate
        </Button>
        {QUICK_ADJUSTS.map((qa) => (
          <Button
            key={qa.label}
            variant="ghost"
            size="sm"
            disabled={genPending}
            onClick={() => regenerate(qa.instruction)}
          >
            {qa.label}
          </Button>
        ))}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {edited && (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={savePending}
                onClick={() =>
                  startSave(async () => {
                    const res = await updateDraft(lead.id, subject, body);
                    if (res.ok) {
                      toast.success("Draft saved");
                      router.refresh();
                    } else toast.error(res.error);
                  })
                }
              >
                {savePending && <Loader2 className="size-3.5 animate-spin" />}
                Save edits
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSubject(draft.subject);
                  setBody(draft.body);
                }}
              >
                <Undo2 className="size-3.5" /> Discard
              </Button>
            </>
          )}
        </div>

        {lead.status === "QUEUED" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const res = await cancelQueued([lead.id]);
              if (res.ok) {
                toast.success("Send canceled — back to Drafted");
                router.refresh();
              } else toast.error(res.error);
            }}
          >
            Cancel queued send
          </Button>
        ) : canSend ? (
          <Button
            size="sm"
            disabled={!gmailConnected || edited}
            title={
              !gmailConnected
                ? "Connect Gmail in Settings first"
                : edited
                  ? "Save your edits first"
                  : undefined
            }
            onClick={() => onRequestSend([lead.id])}
          >
            <Send className="size-3.5" /> Queue send
          </Button>
        ) : draft.sentAt ? (
          <p className="font-mono text-[10px] text-muted-foreground">
            sent {formatDateTime(draft.sentAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
