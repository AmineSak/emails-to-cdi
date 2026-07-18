"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LeadStatus } from "@prisma/client";
import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";
import { Import, Loader2, RefreshCcw, Search, Send, Sparkles, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DashboardMeta, LeadDTO } from "@/lib/lead-dto";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { PipelineRail } from "@/components/leads/pipeline-rail";
import { LeadsTable } from "@/components/leads/leads-table";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { generateDraft } from "@/app/actions/drafts";
import { deleteLeads, syncRepliesAction } from "@/app/actions/leads";
import { cancelQueued, queueSend } from "@/app/actions/send";

const DATE_RANGES = [
  { value: "all", label: "All time", days: null },
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
] as const;

export function Dashboard({ leads, meta }: { leads: LeadDTO[]; meta: DashboardMeta }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | null>(null);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRangeRaw] = useState<string>("all");
  // Cutoff is computed in the event handler (not during render) to keep the memo pure
  const [dateCutoff, setDateCutoff] = useState<number | null>(null);
  const setDateRange = (value: string) => {
    setDateRangeRaw(value);
    const days = DATE_RANGES.find((r) => r.value === value)?.days ?? null;
    setDateCutoff(days ? Date.now() - days * 86_400_000 : null);
  };
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [sendCandidates, setSendCandidates] = useState<string[] | null>(null);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const genCancelled = useRef(false);
  const [syncPending, startSync] = useTransition();
  const [sendPending, startSend] = useTransition();
  const [deletePending, startDelete] = useTransition();

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<LeadStatus, number>;
    for (const l of leads) c[l.status]++;
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (dateCutoff && new Date(l.createdAt).getTime() < dateCutoff) return false;
      if (!q) return true;
      return [l.firstName, l.lastName, l.email, l.companyName, l.jobTitle]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [leads, statusFilter, search, dateCutoff]);

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );
  const selectedLeads = useMemo(
    () => leads.filter((l) => selectedIds.includes(l.id)),
    [leads, selectedIds],
  );
  const openLead = openLeadId ? (leads.find((l) => l.id === openLeadId) ?? null) : null;

  const sent = counts.SENT + counts.REPLIED + counts.INTERVIEW + counts.REJECTED + counts.NO_RESPONSE + counts.BOUNCED;
  const replied = counts.REPLIED + counts.INTERVIEW + counts.REJECTED;
  const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : null;

  async function bulkGenerate() {
    const targets = selectedLeads.filter((l) =>
      ["NOT_CONTACTED", "DRAFTED"].includes(l.status),
    );
    if (targets.length === 0) {
      toast.error("Select leads that are Not contacted or Drafted");
      return;
    }
    genCancelled.current = false;
    setGenProgress({ done: 0, total: targets.length });
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      if (genCancelled.current) break;
      const res = await generateDraft(targets[i].id);
      if (!res.ok) {
        failed++;
        toast.error(`${targets[i].companyName || targets[i].email}: ${res.error}`);
        if (failed >= 3) {
          toast.error("Stopping after 3 failures — check your setup");
          break;
        }
      }
      setGenProgress({ done: i + 1, total: targets.length });
    }
    setGenProgress(null);
    router.refresh();
    const ok = targets.length - failed;
    if (ok > 0) toast.success(`${ok} draft${ok > 1 ? "s" : ""} ready for review`);
  }

  function confirmSend() {
    const ids = sendCandidates ?? [];
    setSendCandidates(null);
    startSend(async () => {
      const res = await queueSend(ids);
      if (res.ok) {
        toast.success(`${res.queued} email${(res.queued ?? 0) > 1 ? "s" : ""} queued`, {
          description: res.capNote ?? "Sends are spaced out automatically — keep a tab open or let the cron drain the queue.",
        });
        setRowSelection({});
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const sendableSelection = selectedLeads.filter(
    (l) => l.draft && ["DRAFTED", "NO_RESPONSE"].includes(l.status),
  );
  const queuedSelection = selectedLeads.filter((l) => l.status === "QUEUED");

  if (leads.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8">
        <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">
          Empty pipeline
        </p>
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          No leads yet
        </h1>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Import a CSV of contacts to start sending personalized candidatures spontanées.
        </p>
        <Button nativeButton={false} render={<Link href="/import" />}>
          <Import className="size-4" /> Import a CSV
        </Button>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{leads.length}</span> leads ·{" "}
            <span className="font-mono tabular-nums">{sent}</span> contacted
            {replyRate !== null && (
              <>
                {" "}· <span className="font-mono tabular-nums">{replyRate}%</span> reply rate
              </>
            )}
            {counts.INTERVIEW > 0 && (
              <>
                {" "}· <span className="font-mono tabular-nums">{counts.INTERVIEW}</span> interview
                {counts.INTERVIEW > 1 ? "s" : ""}
              </>
            )}
            {meta.queuedCount > 0 && (
              <>
                {" "}· <span className="font-mono tabular-nums">{meta.queuedCount}</span> queued
                {" "}(<span className="font-mono tabular-nums">{meta.sentToday}/{meta.dailySendCap}</span> sent today)
              </>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={syncPending || !meta.gmailConnected}
          title={meta.gmailConnected ? undefined : "Connect Gmail in Settings first"}
          onClick={() =>
            startSync(async () => {
              const res = await syncRepliesAction();
              if (res.ok && res.result) {
                const { checked, replies, bounces } = res.result;
                toast.success(
                  replies + bounces > 0
                    ? `${replies} repl${replies === 1 ? "y" : "ies"}${bounces > 0 ? `, ${bounces} bounce${bounces > 1 ? "s" : ""}` : ""} found`
                    : "No new replies",
                  { description: `${checked} thread${checked === 1 ? "" : "s"} checked` },
                );
                router.refresh();
              } else if (!res.ok) toast.error(res.error);
            })
          }
        >
          {syncPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Sync replies
        </Button>
      </header>

      <div className="mb-6">
        <PipelineRail
          counts={counts}
          active={statusFilter}
          onToggle={(s) => setStatusFilter((cur) => (cur === s ? null : s))}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, email…"
            className="h-8 w-64 pl-8 text-sm"
          />
        </div>
        <Select
          items={{
            all: "All statuses",
            ...Object.fromEntries(STATUS_ORDER.map((s) => [s, STATUS_META[s].label])),
          }}
          value={statusFilter ?? "all"}
          onValueChange={(v) => setStatusFilter(v === "all" || !v ? null : (v as LeadStatus))}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].label} ({counts[s]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={Object.fromEntries(DATE_RANGES.map((r) => [r.value, r.label]))}
          value={dateRange}
          onValueChange={(v) => setDateRange(v ?? "all")}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(statusFilter || search || dateRange !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter(null);
              setSearch("");
              setDateRange("all");
            }}
          >
            <X className="size-3.5" /> Clear
          </Button>
        )}
        <p className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
          {filtered.length} / {leads.length}
        </p>
      </div>

      <LeadsTable
        leads={filtered}
        sorting={sorting}
        onSortingChange={setSorting}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        onOpenLead={setOpenLeadId}
      />

      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit items-center gap-2 rounded-lg border bg-card px-4 py-2.5 shadow-lg">
          <p className="pr-2 font-mono text-xs tabular-nums">
            {selectedIds.length} selected
          </p>
          {genProgress ? (
            <div className="flex items-center gap-3">
              <Progress value={(genProgress.done / genProgress.total) * 100} className="w-40" />
              <p className="font-mono text-xs tabular-nums text-muted-foreground">
                {genProgress.done}/{genProgress.total}
              </p>
              <Button variant="ghost" size="sm" onClick={() => (genCancelled.current = true)}>
                Stop
              </Button>
            </div>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={bulkGenerate}>
                <Sparkles className="size-3.5" /> Generate drafts
              </Button>
              <Button
                size="sm"
                disabled={sendableSelection.length === 0 || sendPending || !meta.gmailConnected}
                title={!meta.gmailConnected ? "Connect Gmail in Settings first" : undefined}
                onClick={() => setSendCandidates(sendableSelection.map((l) => l.id))}
              >
                {sendPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Send {sendableSelection.length > 0 ? sendableSelection.length : ""}
              </Button>
              {queuedSelection.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const res = await cancelQueued(queuedSelection.map((l) => l.id));
                    if (res.ok) {
                      toast.success(`${res.canceled} send${(res.canceled ?? 0) > 1 ? "s" : ""} canceled`);
                      setRowSelection({});
                      router.refresh();
                    } else toast.error(res.error);
                  }}
                >
                  Cancel queued
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={deletePending}
                onClick={() =>
                  startDelete(async () => {
                    const res = await deleteLeads(selectedIds);
                    if (res.ok) {
                      toast.success(res.message);
                      setRowSelection({});
                      router.refresh();
                    } else toast.error(res.error);
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>
                <X className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      )}

      <LeadDrawer
        lead={openLead}
        gmailConnected={meta.gmailConnected}
        onClose={() => setOpenLeadId(null)}
        onRequestSend={(ids) => setSendCandidates(ids)}
      />

      <AlertDialog
        open={sendCandidates !== null}
        onOpenChange={(open) => !open && setSendCandidates(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Queue {sendCandidates?.length ?? 0} email{(sendCandidates?.length ?? 0) > 1 ? "s" : ""} for sending?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Emails go out from{" "}
              <span className="font-mono text-foreground">{meta.gmailEmail}</span>, spaced out
              automatically, {meta.dailySendCap}/day max ({meta.sentToday} already sent today).
              You can cancel queued sends until they leave.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend}>
              <Send className="size-3.5" /> Queue for sending
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
