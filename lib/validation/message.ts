/**
 * Message validation — group chat and DMs share the same rule:
 * 1–2,000 characters, and whitespace-only doesn't count as content.
 * The boundary (2,000 passes, 2,001 fails) is unit-tested.
 */
import { z } from "zod";
import { MESSAGE_MAX_LENGTH } from "@/lib/constants";

export const messageContentSchema = z
  .string()
  .max(
    MESSAGE_MAX_LENGTH,
    `Messages max out at ${MESSAGE_MAX_LENGTH.toLocaleString()} characters.`,
  )
  .refine((content) => content.trim().length > 0, {
    message: "Type a message first.",
  });
