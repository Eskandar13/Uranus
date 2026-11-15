"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/i18n/config";
import { useT } from "../hooks";

/** Vertical lists only: ignore horizontal movement. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export interface HandleProps {
  setNode: (el: HTMLElement | null) => void;
  label: string;
  props: Record<string, unknown>;
}

/**
 * Accessible vertical sortable list (@dnd-kit): mouse, touch (short press on the handle) and
 * keyboard (space/enter to pick up, arrows to move). Rows render their own drag handle.
 */
export function SortableList<T extends { id: string }>({
  items,
  getName,
  onReorder,
  renderItem,
  className,
  disabled = false,
}: {
  items: T[];
  getName: (item: T) => string;
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T, handle: HandleProps, dragging: boolean) => ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const dndId = useId();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (id: UniqueIdentifier) => {
    const item = items.find((i) => i.id === id);
    return item ? getName(item) : "";
  };
  const position = (id: UniqueIdentifier | undefined) => (id === undefined ? 0 : items.findIndex((i) => i.id === id) + 1);
  const announcements: Announcements = {
    onDragStart: ({ active }) => fmt(t.dnd.picked, { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) => (over ? fmt(t.dnd.over, { name: nameOf(active.id), n: position(over.id) }) : undefined),
    onDragEnd: ({ active, over }) => (over ? fmt(t.dnd.dropped, { name: nameOf(active.id), n: position(over.id) }) : undefined),
    onDragCancel: ({ active }) => fmt(t.dnd.cancelled, { name: nameOf(active.id) }),
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to).map((i) => i.id));
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t.dnd.instructions } }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul className={cn("flex flex-col gap-2", className)}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id} label={fmt(t.menuPage.dragHandle, { name: getName(item) })}>
              {(handle, dragging) => renderItem(item, handle, dragging)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: (handle: HandleProps, dragging: boolean) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };
  return (
    <li ref={setNodeRef} style={style} className={cn(isDragging && "dash-dragging rounded-2xl")}>
      {children({ setNode: setActivatorNodeRef, label, props: { ...attributes, ...listeners } }, isDragging)}
    </li>
  );
}

/** The grip button rows put on their start side. */
export function DragHandle({ handle, className }: { handle: HandleProps; className?: string }) {
  const { setNode, props, label } = handle;
  return (
    <button
      type="button"
      ref={setNode}
      {...props}
      aria-label={label}
      className={cn(
        "grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground/70 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing",
        className,
      )}
    >
      <GripVertical className="size-4.5" aria-hidden />
    </button>
  );
}
