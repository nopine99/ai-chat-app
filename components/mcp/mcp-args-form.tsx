"use client";

import { useEffect, useMemo, useState } from "react";

import { McpFieldInput } from "@/components/mcp/mcp-field-input";
import {
  buildArguments,
  createInitialValues,
  setValueAtPath,
  validateFields,
  type FieldPath,
  type RawValue,
  type RawValues,
  type SchemaField,
} from "@/lib/mcp/schema-form";

export type McpArgsResult =
  | { args: Record<string, unknown>; error: null }
  | { args: null; error: string };

interface McpArgsFormProps {
  fields: SchemaField[];
  onChange: (result: McpArgsResult) => void;
}

export function McpArgsForm({ fields, onChange }: McpArgsFormProps) {
  const [formValues, setFormValues] = useState<RawValues>(() =>
    createInitialValues(fields)
  );

  const result = useMemo<McpArgsResult>(() => {
    const error = validateFields(fields, formValues);
    if (error) return { args: null, error };
    return { args: buildArguments(fields, formValues), error: null };
  }, [fields, formValues]);

  // onChange는 항상 부모의 useState setter(안정된 참조)라 여기서 의존해도 안전하다.
  useEffect(() => {
    onChange(result);
  }, [result, onChange]);

  if (fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        이 항목은 별도 입력값이 필요하지 않아요.
      </p>
    );
  }

  const handleChange = (path: FieldPath, value: RawValue) => {
    setFormValues((prev) => setValueAtPath(prev, path, value));
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-muted-foreground">입력 항목</span>
      {fields.map((field) => (
        <McpFieldInput
          key={field.key}
          field={field}
          path={[field.key]}
          values={formValues}
          onChange={handleChange}
        />
      ))}
    </div>
  );
}
