import { REQUIRED_COLUMNS, type RawLeadRow } from "./types";

function splitCsvRecords(csvText: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === '"') {
      current += char;
      if (inQuotes && next === '"') {
        current += next;
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      if (current.trim().length > 0) {
        records.push(current);
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    records.push(current);
  }

  return records;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsv(csvText: string): RawLeadRow[] {
  const lines = splitCsvRecords(csvText);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^\uFEFF/, ""));
  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column)) {
      throw new Error(`Missing expected CSV column: ${column}`);
    }
  }

  const rows: RawLeadRow[] = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const rowObject: Record<string, string> = {};
    for (let index = 0; index < headers.length; index += 1) {
      rowObject[headers[index]] = values[index] ?? "";
    }
    rows.push({
      "External ID": rowObject["External ID"] ?? "",
      "Date Added": rowObject["Date Added"] ?? "",
      Name: rowObject.Name ?? "",
      Stage: rowObject.Stage ?? "",
      Timeframe: rowObject.Timeframe ?? "",
      "Is Contacted": rowObject["Is Contacted"] ?? "",
      "Listing Price": rowObject["Listing Price"] ?? "",
      "Property Price": rowObject["Property Price"] ?? "",
      Tags: rowObject.Tags ?? "",
      "Assigned To": rowObject["Assigned To"] ?? "",
      "Email 1": rowObject["Email 1"] ?? "",
      "Phone 1": rowObject["Phone 1"] ?? "",
      "Property Address": rowObject["Property Address"] ?? "",
      "Property City": rowObject["Property City"] ?? "",
      "Property MLS Number": rowObject["Property MLS Number"] ?? "",
      "Lead Source": rowObject["Lead Source"] ?? "",
      Message: rowObject.Message ?? "",
      Description: rowObject.Description ?? "",
      Notes: rowObject.Notes ?? "",
      "Estim. Moving Date": rowObject["Estim. Moving Date"] ?? "",
      "Move-in Date": rowObject["Move-in Date"] ?? ""
    });
  }

  return rows;
}
