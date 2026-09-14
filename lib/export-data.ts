export interface ExportSection {
  name: string;
  rows: unknown[] | null | undefined;
}

export interface ExportMetadata {
  title: string;
  subject?: string | null;
  generatedAt?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function normalizeRows(rows: unknown[] | null | undefined) {
  return Array.isArray(rows) ? rows.filter((row) => row !== null && row !== undefined) : [];
}

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (!isRecord(value)) {
    return { [prefix || "value"]: value == null ? "" : String(value) };
  }

  return Object.entries(value).reduce<Record<string, string>>((acc, [key, child]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(child)) {
      acc[nextKey] = child
        .map((item) => (isRecord(item) || Array.isArray(item) ? JSON.stringify(item) : String(item ?? "")))
        .join("; ");
    } else if (isRecord(child)) {
      Object.assign(acc, flatten(child, nextKey));
    } else {
      acc[nextKey] = child == null ? "" : String(child);
    }
    return acc;
  }, {});
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildJsonExport(metadata: ExportMetadata, sections: ExportSection[]) {
  const generatedAt = metadata.generatedAt ?? new Date().toISOString();
  const data = sections.reduce<Record<string, unknown[]>>((acc, section) => {
    acc[section.name] = normalizeRows(section.rows);
    return acc;
  }, {});

  return JSON.stringify(
    {
      title: metadata.title,
      subject: metadata.subject ?? null,
      generatedAt,
      sections: data,
    },
    null,
    2,
  );
}

export function buildCsvExport(metadata: ExportMetadata, sections: ExportSection[]) {
  const generatedAt = metadata.generatedAt ?? new Date().toISOString();
  const output: string[][] = [
    ["section", "row", "field", "value"],
    ["metadata", "", "title", metadata.title],
    ["metadata", "", "subject", metadata.subject ?? ""],
    ["metadata", "", "generatedAt", generatedAt],
  ];

  for (const section of sections) {
    const rows = normalizeRows(section.rows);
    if (rows.length === 0) {
      output.push([section.name, "", "__empty", ""]);
      continue;
    }

    rows.forEach((row, index) => {
      const flattened = flatten(row);
      Object.entries(flattened).forEach(([field, value]) => {
        output.push([section.name, String(index + 1), field, value]);
      });
    });
  }

  return output.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export function downloadTextFile(filename: string, text: string, mimeType: string) {
  if (typeof document === "undefined") {
    throw new Error("File downloads are only available in the browser.");
  }

  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
