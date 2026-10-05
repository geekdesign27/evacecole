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
import type * as exercises from "../exercises.js";
import type * as files from "../files.js";
import type * as lib from "../lib.js";
import type * as mail from "../mail.js";
import type * as mailData from "../mailData.js";
import type * as mailTemplates from "../mailTemplates.js";
import type * as mergeLogic from "../mergeLogic.js";
import type * as observations from "../observations.js";
import type * as team from "../team.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  exercises: typeof exercises;
  files: typeof files;
  lib: typeof lib;
  mail: typeof mail;
  mailData: typeof mailData;
  mailTemplates: typeof mailTemplates;
  mergeLogic: typeof mergeLogic;
  observations: typeof observations;
  team: typeof team;
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
