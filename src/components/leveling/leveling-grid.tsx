"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, GripVertical, MoreHorizontal, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCurrency, formatPercent, calcVariance, calcVariancePct, cn } from "@/lib/utils"
import type { LineItem, Recipient, LevelingCell, Proposal } from "@/types/database"

type RecipientWithProposal = Recipient & {
  proposals: Pick<Proposal, "id" | "total_fee" | "extraction_status">[]
}

interface LevelingGridProps {
  rfpId: string
  rfpBudget: number | null
  lineItems: LineItem[]
  recipients: RecipientWithProposal[]
  cells: LevelingCell[]
}

type CellKey = `${string}-${string | "budget"}`

function cellKey(lineItemId: string, recipientId: string | null): CellKey {
  return `${lineItemId}-${recipientId ?? "budget"}`
}

export function LevelingGrid({ rfpId, rfpBudget, lineItems: initialLineItems, recipients, cells: initialCells }: LevelingGridProps) {
  const router = useRouter()
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems)
  const [cells, setCells] = useState<Record<CellKey, LevelingCell>>(
    Object.fromEntries(initialCells.map((c) => [cellKey(c.line_item_id, c.recipient_id), c]))
  )
  const [editingCell, setEditingCell] = useState<CellKey | null>(null)
  const [editValue, setEditValue] = useState("")
  const [addingRow, setAddingRow] = useState(false)
  const [newRowLabel, setNewRowLabel] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const saveTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Compute totals
  function totalForRecipient(recipientId: string | null): number {
    return lineItems.reduce((sum, li) => {
      const key = cellKey(li.id, recipientId)
      return sum + (cells[key]?.value ?? 0)
    }, 0)
  }

  // Start editing a cell
  function startEdit(lineItemId: string, recipientId: string | null) {
    const key = cellKey(lineItemId, recipientId)
    const existing = cells[key]
    setEditingCell(key)
    setEditValue(existing?.value?.toString() ?? "")
  }

  // Save cell value
  async function saveCell(lineItemId: string, recipientId: string | null, rawValue: string) {
    const key = cellKey(lineItemId, recipientId)
    const numValue = rawValue === "" ? null : parseFloat(rawValue.replace(/[,$]/g, ""))
    const existing = cells[key]

    // Optimistic update
    setCells((prev) => ({
      ...prev,
      [key]: {
        ...(existing ?? {
          id: crypto.randomUUID(),
          rfp_id: rfpId,
          line_item_id: lineItemId,
          recipient_id: recipientId,
          org_id: "",
          text_value: null,
          notes: null,
          is_override: false,
          source_text: null,
          source_page: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        value: numValue,
        is_override: true,
        updated_at: new Date().toISOString(),
      },
    }))

    setEditingCell(null)

    // Debounce save
    const timeoutKey = key
    if (saveTimeouts.current[timeoutKey]) clearTimeout(saveTimeouts.current[timeoutKey])
    saveTimeouts.current[timeoutKey] = setTimeout(async () => {
      await fetch("/api/leveling/cells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfp_id: rfpId,
          line_item_id: lineItemId,
          recipient_id: recipientId,
          value: numValue,
          is_override: true,
        }),
      })
    }, 500)
  }

  // Add line item
  async function addLineItem() {
    if (!newRowLabel.trim()) return
    const res = await fetch("/api/leveling/line-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rfp_id: rfpId,
        label: newRowLabel.trim(),
        sort_order: lineItems.length,
      }),
    })
    if (res.ok) {
      const newItem = await res.json()
      setLineItems((prev) => [...prev, newItem])
      setNewRowLabel("")
      setAddingRow(false)
    }
  }

  // Delete line item
  async function deleteLineItem(id: string) {
    await fetch(`/api/leveling/line-items/${id}`, { method: "DELETE" })
    setLineItems((prev) => prev.filter((li) => li.id !== id))
  }

  // AI suggest columns
  async function runAISuggestions() {
    setAiLoading(true)
    // Trigger extraction for all proposals that haven't been extracted
    for (const r of recipients) {
      const proposal = r.proposals?.[0]
      if (proposal && proposal.extraction_status === "pending") {
        await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposal_id: proposal.id }),
        })
      }
    }
    setAiLoading(false)
    router.refresh()
  }

  const budgetTotal = totalForRecipient(null)
  const hasSubmittedRecipients = recipients.some((r) => r.status === "submitted")

  return (
    <div className="min-h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
        <Button size="sm" variant="outline" onClick={() => setAddingRow(true)}>
          <Plus className="w-3.5 h-3.5" />
          Add Row
        </Button>
        {hasSubmittedRecipients && (
          <Button size="sm" variant="outline" onClick={runAISuggestions} disabled={aiLoading}>
            <Sparkles className="w-3.5 h-3.5" />
            {aiLoading ? "Running AI…" : "Run AI Extraction"}
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <span>Click any cell to edit</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-auto">
        <table className="border-collapse w-full" style={{ minWidth: `${220 + 160 + recipients.length * 160}px` }}>
          <thead>
            <tr>
              {/* Row label header */}
              <th className="leveling-header-cell sticky left-0 z-20 bg-slate-50 text-left w-[220px]">
                Line Item
              </th>
              {/* Budget column */}
              <th className="leveling-header-cell text-right w-[160px]">
                <div className="flex flex-col items-end">
                  <span>Budget</span>
                  {rfpBudget && (
                    <span className="font-normal text-slate-400 text-xs">{formatCurrency(rfpBudget)}</span>
                  )}
                </div>
              </th>
              {/* Bidder columns */}
              {recipients.map((r) => {
                const proposal = r.proposals?.[0]
                const total = totalForRecipient(r.id)
                const variance = calcVariance(rfpBudget, total || null)
                return (
                  <th key={r.id} className="leveling-header-cell text-right w-[160px]">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="truncate max-w-[140px]">{r.company_name ?? r.email}</span>
                      {total > 0 && (
                        <span className="font-semibold text-slate-700">{formatCurrency(total)}</span>
                      )}
                      {variance !== null && total > 0 && (
                        <span className={cn("text-xs font-normal", variance > 0 ? "text-red-600" : "text-emerald-600")}>
                          {formatPercent(calcVariancePct(rfpBudget, total))}
                        </span>
                      )}
                      {proposal?.extraction_status === "done" && (
                        <Badge variant="success" className="text-xs py-0">AI extracted</Badge>
                      )}
                    </div>
                  </th>
                )
              })}
              {/* Variance col */}
              {recipients.length > 1 && (
                <th className="leveling-header-cell text-right w-[100px]">Low / High</th>
              )}
            </tr>
          </thead>

          <tbody>
            {lineItems.map((li) => {
              const budgetCell = cells[cellKey(li.id, null)]
              const budgetVal = budgetCell?.value ?? null

              return (
                <tr key={li.id} className={cn("group", li.is_header && "leveling-header-row")}>
                  {/* Label */}
                  <td className="leveling-row-label">
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab" />
                      <span className={cn("flex-1", li.is_header && "font-semibold")}>{li.label}</span>
                      {!li.is_header && (
                        <button
                          onClick={() => deleteLineItem(li.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Budget cell */}
                  <EditableCell
                    lineItemId={li.id}
                    recipientId={null}
                    cell={budgetCell}
                    isEditing={editingCell === cellKey(li.id, null)}
                    editValue={editValue}
                    isHeader={li.is_header}
                    onStartEdit={() => !li.is_header && startEdit(li.id, null)}
                    onEditChange={setEditValue}
                    onSave={(v) => saveCell(li.id, null, v)}
                    onCancel={() => setEditingCell(null)}
                    isBudget
                  />

                  {/* Bidder cells */}
                  {recipients.map((r) => {
                    const cell = cells[cellKey(li.id, r.id)]
                    return (
                      <EditableCell
                        key={r.id}
                        lineItemId={li.id}
                        recipientId={r.id}
                        cell={cell}
                        isEditing={editingCell === cellKey(li.id, r.id)}
                        editValue={editValue}
                        isHeader={li.is_header}
                        budgetValue={budgetVal}
                        onStartEdit={() => !li.is_header && startEdit(li.id, r.id)}
                        onEditChange={setEditValue}
                        onSave={(v) => saveCell(li.id, r.id, v)}
                        onCancel={() => setEditingCell(null)}
                      />
                    )
                  })}

                  {/* Low/high variance */}
                  {recipients.length > 1 && !li.is_header && (
                    <td className="leveling-cell text-right text-xs text-slate-400">
                      {(() => {
                        const vals = recipients
                          .map((r) => cells[cellKey(li.id, r.id)]?.value)
                          .filter((v): v is number => v != null)
                        if (!vals.length) return null
                        const low = Math.min(...vals)
                        const high = Math.max(...vals)
                        if (low === high) return formatCurrency(low)
                        return (
                          <span>
                            <span className="text-emerald-600">{formatCurrency(low)}</span>
                            {" / "}
                            <span className="text-red-500">{formatCurrency(high)}</span>
                          </span>
                        )
                      })()}
                    </td>
                  )}
                </tr>
              )
            })}

            {/* Totals row */}
            <tr className="bg-slate-900 text-white font-semibold">
              <td className="px-3 py-2.5 text-sm sticky left-0 bg-slate-900 z-10">Total</td>
              <td className="px-2 py-2.5 text-sm text-right">
                {totalForRecipient(null) > 0 ? formatCurrency(totalForRecipient(null)) : "—"}
              </td>
              {recipients.map((r) => {
                const total = totalForRecipient(r.id)
                const budgetTotalVal = totalForRecipient(null)
                const variance = calcVariancePct(budgetTotalVal || null, total || null)
                return (
                  <td key={r.id} className="px-2 py-2.5 text-sm text-right">
                    <div className="flex flex-col items-end">
                      {total > 0 ? formatCurrency(total) : "—"}
                      {variance !== null && total > 0 && (
                        <span className={cn("text-xs font-normal", variance > 0 ? "text-red-300" : "text-emerald-300")}>
                          {formatPercent(variance)}
                        </span>
                      )}
                    </div>
                  </td>
                )
              })}
              {recipients.length > 1 && <td />}
            </tr>

            {/* Add row */}
            {addingRow && (
              <tr>
                <td className="leveling-row-label" colSpan={2 + recipients.length + (recipients.length > 1 ? 1 : 0)}>
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      placeholder="Row label (e.g. Structural Engineering)"
                      value={newRowLabel}
                      onChange={(e) => setNewRowLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addLineItem()
                        if (e.key === "Escape") setAddingRow(false)
                      }}
                      className="h-7 text-sm"
                    />
                    <Button size="sm" onClick={addLineItem} className="h-7">Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingRow(false)} className="h-7">Cancel</Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface EditableCellProps {
  lineItemId: string
  recipientId: string | null
  cell: LevelingCell | undefined
  isEditing: boolean
  editValue: string
  isHeader: boolean
  budgetValue?: number | null
  isBudget?: boolean
  onStartEdit: () => void
  onEditChange: (v: string) => void
  onSave: (v: string) => void
  onCancel: () => void
}

function EditableCell({
  cell,
  isEditing,
  editValue,
  isHeader,
  budgetValue,
  isBudget,
  onStartEdit,
  onEditChange,
  onSave,
  onCancel,
}: EditableCellProps) {
  const value = cell?.value ?? null
  const variance = !isBudget && budgetValue != null && value != null
    ? calcVariancePct(budgetValue, value)
    : null

  if (isHeader) {
    return <td className="leveling-cell bg-slate-50" />
  }

  if (isEditing) {
    return (
      <td className="leveling-cell p-0">
        <Input
          autoFocus
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={() => onSave(editValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(editValue)
            if (e.key === "Escape") onCancel()
          }}
          className="h-full w-full border-0 rounded-none text-right text-sm focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          type="number"
          placeholder="0"
        />
      </td>
    )
  }

  return (
    <td
      className={cn(
        "leveling-cell text-right cursor-pointer hover:bg-blue-50 transition-colors group/cell",
        isBudget && "bg-slate-50",
        cell?.is_override && "bg-amber-50"
      )}
      onClick={onStartEdit}
      title={cell?.notes ?? cell?.source_text ?? undefined}
    >
      <div className="flex flex-col items-end">
        {value != null ? (
          <span className={cn("text-sm tabular-nums", isBudget && "text-slate-500")}>
            {formatCurrency(value)}
          </span>
        ) : (
          <span className="text-slate-300 text-sm opacity-0 group-hover/cell:opacity-100">+</span>
        )}
        {variance !== null && (
          <span className={cn("text-xs", variance > 0 ? "text-red-500" : "text-emerald-600")}>
            {formatPercent(variance)}
          </span>
        )}
        {cell?.source_text && (
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-0.5" title="AI extracted" />
        )}
      </div>
    </td>
  )
}
