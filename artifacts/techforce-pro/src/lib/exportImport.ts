/**
 * Enhanced Export & Import Module
 * Advanced data export/import with formats and templates
 */

export interface ExportOptions {
  format: "csv" | "json" | "xlsx" | "pdf";
  includeFields?: string[];
  dateRange?: { start: Date; end: Date };
  compress?: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  warnings: string[];
}

/**
 * Export data to CSV format
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  fields?: (keyof T)[]
): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const headers = fields && fields.length > 0
    ? fields
    : Object.keys(data[0]);

  const csvContent = [
    headers.join(","),
    ...data.map(row =>
      headers
        .map(header => {
          const value = row[header as keyof T];
          // Escape quotes and wrap in quotes if contains comma or quote
          const stringValue = String(value ?? "");
          if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(",")
    ),
  ].join("\n");

  downloadFile(csvContent, filename, "text/csv");
}

/**
 * Export data to JSON format
 */
export function exportToJSON<T extends Record<string, any>>(
  data: T[],
  filename: string,
  pretty: boolean = true
): void {
  const jsonContent = pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);

  downloadFile(jsonContent, filename, "application/json");
}

/**
 * Export data with formatting and metadata
 */
export function exportWithMetadata<T extends Record<string, any>>(
  data: T[],
  metadata: {
    title: string;
    description: string;
    version: string;
    exportDate: Date;
    exportedBy?: string;
  },
  filename: string
): void {
  const exportData = {
    metadata,
    data,
    statistics: {
      totalRecords: data.length,
      fields: data.length > 0 ? Object.keys(data[0]) : [],
    },
  };

  downloadFile(
    JSON.stringify(exportData, null, 2),
    filename,
    "application/json"
  );
}

/**
 * Export to HTML table format
 */
export function exportToHTML<T extends Record<string, any>>(
  data: T[],
  filename: string,
  title: string = "Data Export"
): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const headers = Object.keys(data[0]);
  const timestamp = new Date().toLocaleString();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">
    <p>Exported on: ${timestamp}</p>
    <p>Total Records: ${data.length}</p>
  </div>
  <table>
    <thead>
      <tr>
        ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${data.map(row => `
        <tr>
          ${headers.map(h => `<td>${escapeHtml(String(row[h] ?? ""))}</td>`).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>
  `;

  downloadFile(htmlContent, filename, "text/html");
}

/**
 * Generate custom report with sections
 */
export function generateReport<T extends Record<string, any>>(
  sections: Array<{
    title: string;
    data: T[];
    fields: string[];
  }>,
  reportTitle: string,
  filename: string
): void {
  const timestamp = new Date().toLocaleString();

  let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    h1 { color: #1a1a1a; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #4CAF50; margin-top: 30px; }
    .report-header { margin-bottom: 30px; }
    .meta { color: #666; font-size: 12px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .section { page-break-inside: avoid; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${reportTitle}</h1>
    <div class="meta">
      <p>Generated: ${timestamp}</p>
    </div>
  </div>
  `;

  sections.forEach(section => {
    htmlContent += `
  <div class="section">
    <h2>${escapeHtml(section.title)}</h2>
    <table>
      <thead>
        <tr>
          ${section.fields.map(f => `<th>${escapeHtml(f)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${section.data.map(row => `
          <tr>
            ${section.fields.map(f => `<td>${escapeHtml(String(row[f] ?? ""))}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
    `;
  });

  htmlContent += `
  <div class="footer">
    <p>TechForce Pro - Confidential Report</p>
  </div>
</body>
</html>
  `;

  downloadFile(htmlContent, filename, "text/html");
}

/**
 * Parse and validate imported CSV data
 */
export function parseCSV(csvContent: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = csvContent.trim().split("\n");
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Download file to client
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Validate data before import
 */
export function validateImportData<T extends Record<string, any>>(
  rows: Record<string, string>[],
  schema: Record<string, { type: string; required?: boolean }>
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  rows.forEach((row, index) => {
    Object.entries(schema).forEach(([field, rules]) => {
      const value = row[field];

      if (rules.required && !value) {
        errors.push(`Row ${index + 1}: Missing required field "${field}"`);
      }

      if (value && rules.type === "number" && isNaN(Number(value))) {
        errors.push(`Row ${index + 1}: Field "${field}" must be a number`);
      }

      if (value && rules.type === "date" && isNaN(new Date(value).getTime())) {
        warnings.push(`Row ${index + 1}: Field "${field}" has invalid date format`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}
