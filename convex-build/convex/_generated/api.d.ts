/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as ai from "../ai.js";
import type * as appointments from "../appointments.js";
import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as employees from "../employees.js";
import type * as invoices from "../invoices.js";
import type * as jobs from "../jobs.js";
import type * as openJobs from "../openJobs.js";
import type * as recurringSchedules from "../recurringSchedules.js";
import type * as serviceRequests from "../serviceRequests.js";
import type * as tasks from "../tasks.js";
import type * as timeoff from "../timeoff.js";
import type * as vans from "../vans.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  ai: typeof ai;
  appointments: typeof appointments;
  customers: typeof customers;
  dashboard: typeof dashboard;
  employees: typeof employees;
  invoices: typeof invoices;
  jobs: typeof jobs;
  openJobs: typeof openJobs;
  recurringSchedules: typeof recurringSchedules;
  serviceRequests: typeof serviceRequests;
  tasks: typeof tasks;
  timeoff: typeof timeoff;
  vans: typeof vans;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
