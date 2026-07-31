/** Tool inputSchema → 값 입력 폼 트리. 해석 실패 시에도 JSON 없이 필드로 낮춘다. */

export type SchemaFieldKind =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "object"
  | "array"
  | "record"
  | "unknown";

interface SchemaFieldBase {
  /** 부모 객체 안에서의 속성 이름. 배열 항목 필드는 빈 문자열이다. */
  key: string;
  title?: string;
  description?: string;
  required: boolean;
}

export interface ScalarSchemaField extends SchemaFieldBase {
  kind: "string" | "number" | "unknown";
}

export interface BooleanSchemaField extends SchemaFieldBase {
  kind: "boolean";
  defaultValue: boolean;
}

export interface EnumSchemaField extends SchemaFieldBase {
  kind: "enum";
  options: string[];
}

export interface ObjectSchemaField extends SchemaFieldBase {
  kind: "object";
  fields: SchemaField[];
}

export interface ArraySchemaField extends SchemaFieldBase {
  kind: "array";
  item: SchemaField;
}

/** properties를 알 수 없는 자유형 객체. 이름/값 문자열 쌍으로 입력한다. */
export interface RecordSchemaField extends SchemaFieldBase {
  kind: "record";
}

export type SchemaField =
  | ScalarSchemaField
  | BooleanSchemaField
  | EnumSchemaField
  | ObjectSchemaField
  | ArraySchemaField
  | RecordSchemaField;

/** 폼이 보관하는 날것의 입력값. 스칼라는 문자열, 체크박스는 boolean으로 다룬다. */
export type RawValue = string | boolean | RawValue[] | { [key: string]: RawValue };
export type RawValues = Record<string, RawValue>;

export type FieldPath = ReadonlyArray<string | number>;

const MAX_DEPTH = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function textOf(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function asText(value: RawValue | undefined): string {
  return typeof value === "string" ? value : "";
}

export function asValueList(value: RawValue | undefined): RawValue[] {
  return Array.isArray(value) ? value : [];
}

export function asValueRecord(value: RawValue | undefined): RawValues {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {};
}

function unescapePointer(segment: string): string {
  return decodeURIComponent(segment).replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveRef(ref: string, root: Record<string, unknown>): unknown {
  if (!ref.startsWith("#/")) return undefined;

  let node: unknown = root;
  for (const segment of ref.slice(2).split("/")) {
    if (!isRecord(node)) return undefined;
    node = node[unescapePointer(segment)];
  }
  return node;
}

function mergeSchemas(
  base: Record<string, unknown>,
  extra: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!extra) return base;

  const properties = {
    ...(isRecord(base.properties) ? base.properties : {}),
    ...(isRecord(extra.properties) ? extra.properties : {}),
  };
  const required = [
    ...(isStringArray(base.required) ? base.required : []),
    ...(isStringArray(extra.required) ? extra.required : []),
  ];

  return {
    ...base,
    ...extra,
    ...(Object.keys(properties).length > 0 ? { properties } : {}),
    ...(required.length > 0 ? { required } : {}),
  };
}

function resolveSchema(
  schema: unknown,
  root: Record<string, unknown>,
  seenRefs: ReadonlySet<string>
): Record<string, unknown> | undefined {
  if (!isRecord(schema)) return undefined;

  const ref = schema.$ref;
  if (typeof ref === "string") {
    if (seenRefs.has(ref)) return undefined;
    return resolveSchema(
      resolveRef(ref, root),
      root,
      new Set(seenRefs).add(ref)
    );
  }

  const variants = Array.isArray(schema.anyOf)
    ? schema.anyOf
    : Array.isArray(schema.oneOf)
      ? schema.oneOf
      : undefined;
  if (variants) {
    const picked: unknown = variants.find(
      (variant: unknown) => isRecord(variant) && variant.type !== "null"
    );
    const resolved = resolveSchema(picked, root, seenRefs);
    if (resolved) return resolved;
  }

  if (Array.isArray(schema.allOf)) {
    const parts: unknown[] = schema.allOf;
    return parts.reduce<Record<string, unknown>>(
      (merged, part) => mergeSchemas(merged, resolveSchema(part, root, seenRefs)),
      schema
    );
  }

  return schema;
}

function typeOf(schema: Record<string, unknown>): string | undefined {
  const { type } = schema;
  if (typeof type === "string") return type;
  if (Array.isArray(type)) {
    return type.find(
      (entry: unknown): entry is string =>
        typeof entry === "string" && entry !== "null"
    );
  }
  return undefined;
}

function fieldFromSchema(
  key: string,
  raw: unknown,
  required: boolean,
  root: Record<string, unknown>,
  depth: number
): SchemaField {
  const rawRecord = isRecord(raw) ? raw : {};
  const resolved = resolveSchema(raw, root, new Set()) ?? {};
  const base: SchemaFieldBase = {
    key,
    title: textOf(rawRecord.title) ?? textOf(resolved.title),
    description: textOf(rawRecord.description) ?? textOf(resolved.description),
    required,
  };

  if (depth >= MAX_DEPTH) return { ...base, kind: "unknown" };

  if (isStringArray(resolved.enum) && resolved.enum.length > 0) {
    return { ...base, kind: "enum", options: resolved.enum };
  }
  if (typeof resolved.const === "string") {
    return { ...base, kind: "enum", options: [resolved.const] };
  }

  switch (typeOf(resolved)) {
    case "string":
      return { ...base, kind: "string" };
    case "number":
    case "integer":
      return { ...base, kind: "number" };
    case "boolean":
      return { ...base, kind: "boolean", defaultValue: resolved.default === true };
    case "array": {
      const items: unknown = Array.isArray(resolved.items)
        ? resolved.items[0]
        : resolved.items;
      return {
        ...base,
        kind: "array",
        item: fieldFromSchema("", items, true, root, depth + 1),
      };
    }
    case "object": {
      const fields = objectFields(resolved, root, depth + 1);
      return fields.length > 0
        ? { ...base, kind: "object", fields }
        : { ...base, kind: "record" };
    }
    default:
      return { ...base, kind: "unknown" };
  }
}

function objectFields(
  schema: Record<string, unknown>,
  root: Record<string, unknown>,
  depth: number
): SchemaField[] {
  const { properties } = schema;
  if (!isRecord(properties)) return [];

  const required = isStringArray(schema.required) ? schema.required : [];
  return Object.entries(properties).map(([key, prop]) =>
    fieldFromSchema(key, prop, required.includes(key), root, depth)
  );
}

export function extractSchemaFields(schema: unknown): SchemaField[] {
  if (!isRecord(schema)) return [];
  const resolved = resolveSchema(schema, schema, new Set()) ?? schema;
  return objectFields(resolved, schema, 0);
}

export function createRecordPair(): RawValue {
  return { key: "", value: "" };
}

export function createInitialValue(field: SchemaField): RawValue {
  switch (field.kind) {
    case "boolean":
      return field.defaultValue;
    case "object":
      return createInitialValues(field.fields);
    case "array":
      if (field.item.kind === "number") return ["", ""];
      return field.required ? [createInitialValue(field.item)] : [];
    case "record":
      return field.required ? [createRecordPair()] : [];
    default:
      return "";
  }
}

export function createInitialValues(fields: SchemaField[]): RawValues {
  const values: RawValues = {};
  for (const field of fields) {
    values[field.key] = createInitialValue(field);
  }
  return values;
}

function childAt(
  container: RawValue | undefined,
  key: string | number
): RawValue | undefined {
  if (typeof key === "number") {
    return Array.isArray(container) ? container[key] : undefined;
  }
  return asValueRecord(container)[key];
}

function setIn(
  container: RawValue | undefined,
  path: FieldPath,
  value: RawValue
): RawValue {
  const [head, ...rest] = path;
  if (head === undefined) return value;

  const child = setIn(childAt(container, head), rest, value);

  if (typeof head === "number") {
    const next = Array.isArray(container) ? [...container] : [];
    next[head] = child;
    return next;
  }

  const next: RawValues = { ...asValueRecord(container) };
  next[head] = child;
  return next;
}

export function setValueAtPath(
  values: RawValues,
  path: FieldPath,
  value: RawValue
): RawValues {
  if (path.length === 0) return values;
  return asValueRecord(setIn(values, path, value));
}

function labelOf(field: SchemaField): string {
  return field.title ?? field.key;
}

function validateField(
  field: SchemaField,
  raw: RawValue | undefined,
  label: string
): string | null {
  switch (field.kind) {
    case "boolean":
    case "record":
      return null;

    case "number": {
      const text = asText(raw).trim();
      if (text === "") {
        return field.required ? `${label}은(는) 필수 항목이에요.` : null;
      }
      return Number.isFinite(Number(text))
        ? null
        : `${label}은(는) 숫자여야 해요.`;
    }

    case "object":
      return validateFields(field.fields, asValueRecord(raw), label);

    case "array": {
      const items = asValueList(raw);
      const isScalarItem =
        field.item.kind === "number" ||
        field.item.kind === "string" ||
        field.item.kind === "unknown";

      if (isScalarItem) {
        const filled = items
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => asText(item).trim() !== "");
        if (filled.length === 0) {
          return field.required
            ? `${label}에 값을 1개 이상 입력해주세요.`
            : null;
        }
        for (const { item, index } of filled) {
          const error = validateField(
            { ...field.item, required: true },
            item,
            `${label} ${index + 1}번`
          );
          if (error) return error;
        }
        return null;
      }

      if (items.length === 0) {
        return field.required
          ? `${label}에 항목을 1개 이상 추가해주세요.`
          : null;
      }
      for (const [index, item] of items.entries()) {
        const error = validateField(field.item, item, `${label} ${index + 1}번`);
        if (error) return error;
      }
      return null;
    }

    default:
      return field.required && asText(raw).trim() === ""
        ? `${label}은(는) 필수 항목이에요.`
        : null;
  }
}

export function validateFields(
  fields: SchemaField[],
  values: RawValues,
  prefix = ""
): string | null {
  for (const field of fields) {
    const label = prefix ? `${prefix} › ${labelOf(field)}` : labelOf(field);
    const error = validateField(field, values[field.key], label);
    if (error) return error;
  }
  return null;
}

const OMIT = Symbol("omit");

function coerceText(text: string): unknown {
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function buildValue(field: SchemaField, raw: RawValue | undefined): unknown {
  switch (field.kind) {
    case "boolean":
      return raw === true;

    case "number": {
      const text = asText(raw).trim();
      if (text === "") return OMIT;
      const parsed = Number(text);
      return Number.isFinite(parsed) ? parsed : OMIT;
    }

    case "object": {
      const built = buildArguments(field.fields, asValueRecord(raw));
      return Object.keys(built).length === 0 && !field.required ? OMIT : built;
    }

    case "array": {
      const items = asValueList(raw)
        .map((item) => buildValue(field.item, item))
        .filter((item) => item !== OMIT);
      return items.length === 0 && !field.required ? OMIT : items;
    }

    case "record": {
      const built: Record<string, string> = {};
      for (const pair of asValueList(raw)) {
        const record = asValueRecord(pair);
        const key = asText(record.key).trim();
        if (key !== "") built[key] = asText(record.value);
      }
      return Object.keys(built).length === 0 && !field.required ? OMIT : built;
    }

    case "unknown": {
      const text = asText(raw).trim();
      return text === "" ? OMIT : coerceText(text);
    }

    default: {
      const text = asText(raw);
      return text === "" ? OMIT : text;
    }
  }
}

export function buildArguments(
  fields: SchemaField[],
  values: RawValues
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const field of fields) {
    const value = buildValue(field, values[field.key]);
    if (value !== OMIT) args[field.key] = value;
  }
  return args;
}
