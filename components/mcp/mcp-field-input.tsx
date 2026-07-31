"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  asText,
  asValueList,
  asValueRecord,
  createInitialValue,
  createRecordPair,
  type FieldPath,
  type RawValue,
  type RawValues,
  type SchemaField,
} from "@/lib/mcp/schema-form";
import { cn } from "@/lib/utils";

interface McpFieldInputProps {
  field: SchemaField;
  path: FieldPath;
  values: RawValues;
  onChange: (path: FieldPath, value: RawValue) => void;
  /** 배열 항목처럼 바깥 라벨이 이미 있을 때 숨긴다. */
  hideLabel?: boolean;
}

export function McpFieldInput({
  field,
  path,
  values,
  onChange,
  hideLabel = false,
}: McpFieldInputProps) {
  const value = readAt(values, path);
  const id = pathToId(path);
  const label = field.title ?? field.key;

  if (field.kind === "boolean") {
    return (
      <FieldShell
        id={id}
        label={label}
        required={field.required}
        description={field.description}
        hideLabel={hideLabel}
        inline
      >
        <Switch
          id={id}
          checked={value === true}
          onCheckedChange={(checked) => onChange(path, checked)}
        />
      </FieldShell>
    );
  }

  if (field.kind === "enum") {
    const text = asText(value);
    return (
      <FieldShell
        id={id}
        label={label}
        required={field.required}
        description={field.description}
        hideLabel={hideLabel}
      >
        <Select value={text} onValueChange={(next) => onChange(path, next ?? "")}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="선택해주세요" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldShell>
    );
  }

  if (field.kind === "object") {
    return (
      <FieldShell
        id={id}
        label={label}
        required={field.required}
        description={field.description}
        hideLabel={hideLabel}
      >
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          {field.fields.map((child) => (
            <McpFieldInput
              key={child.key}
              field={child}
              path={[...path, child.key]}
              values={values}
              onChange={onChange}
            />
          ))}
        </div>
      </FieldShell>
    );
  }

  if (field.kind === "array") {
    return (
      <ArrayField
        field={field}
        path={path}
        values={values}
        onChange={onChange}
        hideLabel={hideLabel}
        label={label}
        id={id}
      />
    );
  }

  if (field.kind === "record") {
    return (
      <RecordField
        field={field}
        path={path}
        values={values}
        onChange={onChange}
        hideLabel={hideLabel}
        label={label}
        id={id}
      />
    );
  }

  return (
    <FieldShell
      id={id}
      label={label}
      required={field.required}
      description={field.description}
      hideLabel={hideLabel}
    >
      <Input
        id={id}
        type={field.kind === "number" ? "number" : "text"}
        value={asText(value)}
        onChange={(e) => onChange(path, e.target.value)}
        placeholder={
          field.kind === "number"
            ? "숫자 입력"
            : field.kind === "unknown"
              ? "값 입력"
              : undefined
        }
      />
    </FieldShell>
  );
}

function ArrayField({
  field,
  path,
  values,
  onChange,
  hideLabel,
  label,
  id,
}: {
  field: Extract<SchemaField, { kind: "array" }>;
  path: FieldPath;
  values: RawValues;
  onChange: (path: FieldPath, value: RawValue) => void;
  hideLabel: boolean;
  label: string;
  id: string;
}) {
  const items = asValueList(readAt(values, path));
  const itemIsScalar =
    field.item.kind === "number" ||
    field.item.kind === "string" ||
    field.item.kind === "unknown";

  const addItem = () => {
    onChange(path, [...items, createInitialValue(field.item)]);
  };

  const removeItem = (index: number) => {
    onChange(
      path,
      items.filter((_, i) => i !== index)
    );
  };

  return (
    <FieldShell
      id={id}
      label={label}
      required={field.required}
      description={field.description}
      hideLabel={hideLabel}
    >
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            아직 항목이 없어요. 아래에서 추가해주세요.
          </p>
        ) : (
          items.map((_, index) => (
            <div
              key={`${id}-${index}`}
              className={cn(
                "flex gap-2",
                itemIsScalar ? "items-center" : "items-start"
              )}
            >
              <span className="mt-2 w-6 shrink-0 text-xs text-muted-foreground">
                {index + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <McpFieldInput
                  field={{
                    ...field.item,
                    key: String(index),
                    title:
                      field.item.kind === "number"
                        ? `숫자 ${index + 1}`
                        : field.item.title || `항목 ${index + 1}`,
                    required: true,
                  }}
                  path={[...path, index]}
                  values={values}
                  onChange={onChange}
                  hideLabel={itemIsScalar}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(index)}
                aria-label={`${index + 1}번 항목 삭제`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-1.5"
          onClick={addItem}
        >
          <Plus className="size-3.5" />
          {field.item.kind === "number" ? "숫자 추가" : "항목 추가"}
        </Button>
      </div>
    </FieldShell>
  );
}

function RecordField({
  field,
  path,
  values,
  onChange,
  hideLabel,
  label,
  id,
}: {
  field: Extract<SchemaField, { kind: "record" }>;
  path: FieldPath;
  values: RawValues;
  onChange: (path: FieldPath, value: RawValue) => void;
  hideLabel: boolean;
  label: string;
  id: string;
}) {
  const pairs = asValueList(readAt(values, path));

  const updatePair = (index: number, key: "key" | "value", next: string) => {
    const updated = pairs.map((pair, i) => {
      if (i !== index) return pair;
      return { ...asValueRecord(pair), [key]: next };
    });
    onChange(path, updated);
  };

  return (
    <FieldShell
      id={id}
      label={label}
      required={field.required}
      description={field.description}
      hideLabel={hideLabel}
    >
      <div className="flex flex-col gap-2">
        {pairs.map((pair, index) => {
          const record = asValueRecord(pair);
          return (
            <div key={`${id}-pair-${index}`} className="flex items-center gap-2">
              <Input
                value={asText(record.key)}
                onChange={(e) => updatePair(index, "key", e.target.value)}
                placeholder="이름"
              />
              <Input
                value={asText(record.value)}
                onChange={(e) => updatePair(index, "value", e.target.value)}
                placeholder="값"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onChange(
                    path,
                    pairs.filter((_, i) => i !== index)
                  )
                }
                aria-label={`${index + 1}번 항목 삭제`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-1.5"
          onClick={() => onChange(path, [...pairs, createRecordPair()])}
        >
          <Plus className="size-3.5" />
          항목 추가
        </Button>
      </div>
    </FieldShell>
  );
}

function FieldShell({
  id,
  label,
  required,
  description,
  hideLabel,
  inline = false,
  children,
}: {
  id: string;
  label: string;
  required: boolean;
  description?: string;
  hideLabel: boolean;
  inline?: boolean;
  children: ReactNode;
}) {
  if (hideLabel) {
    return (
      <div className="flex flex-col gap-1">
        {children}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-1.5",
        inline ? "items-center justify-between" : "flex-col"
      )}
    >
      <Label htmlFor={id} className={inline ? "font-normal" : undefined}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {description && !inline && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function readAt(values: RawValues, path: FieldPath): RawValue | undefined {
  let current: RawValue | undefined = values;
  for (const segment of path) {
    if (current === undefined) return undefined;
    if (typeof segment === "number") {
      current = Array.isArray(current) ? current[segment] : undefined;
    } else if (typeof current === "object" && current !== null && !Array.isArray(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function pathToId(path: FieldPath): string {
  return `mcp-arg-${path.map(String).join("-") || "root"}`;
}
