# ZP-TBD-58 — `creatempcommitmentinvoice`: "Less: Pledge - null" fix

**Source:** `DEV_HANDOFF_20260904.md`, item 3.

## Bug

`creatempcommitmentinvoice` (Books, id `5830143000035390935`) looks up the
MP's name from the Books contact record (`mpContactDetails.get("contact")
.get("contact_name")`) to print on the family invoice's pledge line, but
never checked whether that lookup actually returned anything. When it came
back empty, the family's invoice showed:

> Less: Pledge - null

## Fix applied

Three-way fallback, matching the handoff's exact spec:
1. Capture `mpNameFromField` — the display name Books already carries on the
   `cf_mp_contact` custom field itself (`value_formatted`), alongside the
   existing `mpContactId` (`value`).
2. Try the real contact lookup first; only fall back to `mpNameFromField` if
   the lookup came back empty (guarding both a null response and a null
   `contact` object, not just a null name).
3. Build `pledgeDescription` once — `"Less: Pledge - " + mpName"` when a name
   was found either way, or plain `"Less: Pledge"` (no trailing dash) if
   both sources are empty.

Both places that previously concatenated `"Less: Pledge - " + mpName`
directly (the update-in-place branch and the append-new branch for the
family invoice's pledge line) now reference `pledgeDescription` instead.
Verified post-fix per the handoff's own check: `+ mpName` appears exactly
once in the function (inside the `pledgeDescription` assignment).

No other logic touched — the idempotent update-in-place behavior for both
the family invoice's pledge line and the MP's own invoice (from
[[ZP-TBD-52]]) is unchanged.

## Status

Applied live 2026-09-07, confirmed via live function pull — matches exactly.
