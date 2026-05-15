/**
 * Advanced Search & Filtering Module
 * Provides powerful search, filtering, and sorting capabilities
 */

export interface SearchFilter {
  field: string;
  operator: "equals" | "contains" | "startsWith" | "gt" | "lt" | "gte" | "lte" | "between" | "in";
  value: any;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  highlights: string[];
}

export interface SearchOptions {
  query: string;
  filters: SearchFilter[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

/**
 * Perform full-text search on array of objects
 */
export function performSearch<T extends Record<string, any>>(
  items: T[],
  query: string,
  searchFields: string[]
): SearchResult<T>[] {
  if (!query) return items.map(item => ({ item, score: 0, highlights: [] }));

  const results: SearchResult<T>[] = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(" ").filter(w => w.length > 0);

  items.forEach(item => {
    let score = 0;
    const highlights: string[] = [];

    searchFields.forEach(field => {
      const value = String(getNestedValue(item, field) || "").toLowerCase();
      
      // Exact match
      if (value === queryLower) score += 100;
      // Word start match
      else if (value.startsWith(queryLower)) score += 50;
      // Contains match
      else if (value.includes(queryLower)) score += 25;
      // Word-by-word matching
      else {
        let matchedWords = 0;
        queryWords.forEach(word => {
          if (value.includes(word)) {
            matchedWords++;
          }
        });
        score += matchedWords * 10;
      }

      if (score > 0) {
        highlights.push(field);
      }
    });

    if (score > 0) {
      results.push({ item, score, highlights });
    }
  });

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Apply filters to items
 */
export function applyFilters<T extends Record<string, any>>(
  items: T[],
  filters: SearchFilter[]
): T[] {
  return items.filter(item => {
    return filters.every(filter => {
      const value = getNestedValue(item, filter.field);
      return matchesFilter(value, filter.operator, filter.value);
    });
  });
}

/**
 * Sort items by field
 */
export function sortItems<T extends Record<string, any>>(
  items: T[],
  sortBy: string,
  order: "asc" | "desc" = "asc"
): T[] {
  const sorted = [...items].sort((a, b) => {
    const aVal = getNestedValue(a, sortBy);
    const bVal = getNestedValue(b, sortBy);

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === "string") {
      return order === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    if (typeof aVal === "number") {
      return order === "asc" ? aVal - bVal : bVal - aVal;
    }

    if (aVal instanceof Date && bVal instanceof Date) {
      return order === "asc" ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
    }

    return 0;
  });

  return sorted;
}

/**
 * Advanced search with filters and sorting
 */
export function advancedSearch<T extends Record<string, any>>(
  items: T[],
  options: SearchOptions,
  searchFields: string[]
): { results: T[]; total: number; hasMore: boolean } {
  // Text search
  let results = options.query
    ? performSearch(items, options.query, searchFields).map(r => r.item)
    : items;

  // Apply filters
  if (options.filters.length > 0) {
    results = applyFilters(results, options.filters);
  }

  // Sort
  if (options.sortBy) {
    results = sortItems(results, options.sortBy, options.sortOrder || "asc");
  }

  // Pagination
  const limit = options.limit || 20;
  const offset = options.offset || 0;
  const total = results.length;
  const paginated = results.slice(offset, offset + limit);

  return {
    results: paginated,
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * Build filter from query string
 */
export function parseQueryString(queryStr: string): SearchFilter[] {
  const filters: SearchFilter[] = [];
  
  // Example: "status:completed age:>30 name:John"
  const parts = queryStr.split(" ");
  
  parts.forEach(part => {
    if (part.includes(":")) {
      const [field, valueStr] = part.split(":");
      
      if (valueStr.startsWith(">")) {
        filters.push({ field, operator: "gt", value: Number(valueStr.slice(1)) });
      } else if (valueStr.startsWith("<")) {
        filters.push({ field, operator: "lt", value: Number(valueStr.slice(1)) });
      } else if (valueStr.startsWith(">=")) {
        filters.push({ field, operator: "gte", value: Number(valueStr.slice(2)) });
      } else if (valueStr.startsWith("<=")) {
        filters.push({ field, operator: "lte", value: Number(valueStr.slice(2)) });
      } else {
        filters.push({ field, operator: "equals", value: valueStr });
      }
    }
  });

  return filters;
}

/**
 * Get nested object value by dot notation path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Check if value matches filter criteria
 */
function matchesFilter(value: any, operator: string, filterValue: any): boolean {
  switch (operator) {
    case "equals":
      return value == filterValue;
    case "contains":
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    case "startsWith":
      return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
    case "gt":
      return Number(value) > Number(filterValue);
    case "lt":
      return Number(value) < Number(filterValue);
    case "gte":
      return Number(value) >= Number(filterValue);
    case "lte":
      return Number(value) <= Number(filterValue);
    case "between":
      return Number(value) >= filterValue[0] && Number(value) <= filterValue[1];
    case "in":
      return filterValue.includes(value);
    default:
      return true;
  }
}

/**
 * Suggest search terms based on input
 */
export function getSuggestions<T extends Record<string, any>>(
  items: T[],
  field: string,
  input: string
): string[] {
  const values = new Set<string>();

  items.forEach(item => {
    const value = String(getNestedValue(item, field) || "").toLowerCase();
    if (value.includes(input.toLowerCase())) {
      values.add(value);
    }
  });

  return Array.from(values)
    .sort()
    .slice(0, 5);
}

/**
 * Create a predefined filter set
 */
export const PREDEFINED_FILTERS = {
  jobStatus: {
    completed: { field: "status", operator: "equals" as const, value: "completed" },
    pending: { field: "status", operator: "equals" as const, value: "pending" },
    inProgress: { field: "status", operator: "equals" as const, value: "in_progress" },
  },
  dateRange: {
    today: {
      field: "date",
      operator: "equals" as const,
      value: new Date().toISOString().split("T")[0],
    },
    thisWeek: {
      field: "date",
      operator: "between" as const,
      value: [getWeekStart(), getWeekEnd()],
    },
    thisMonth: {
      field: "date",
      operator: "between" as const,
      value: [getMonthStart(), getMonthEnd()],
    },
  },
  revenue: {
    highValue: { field: "revenue", operator: "gte" as const, value: 1000 },
    lowValue: { field: "revenue", operator: "lte" as const, value: 500 },
  },
};

function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

function getWeekEnd(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 6);
  return d.toISOString().split("T")[0];
}

function getMonthStart(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function getMonthEnd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toISOString().split("T")[0];
}
