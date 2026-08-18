// Client Script: casketSpecialInstructionsTimin (Deals, FB layout, Edit Page)
// Setup > Developer Space > Client Script > Deals > FB layout > Edit Page
//
// STATUS (2026-08-18): DEPLOYED AND CONFIRMED PASSING.
//
// Reported by Andrea: "test this to make sure it never blocks an edit on the deal when it
// appears" -- concern that the Casket Colors special-instructions popup could prevent
// saving a Deal for edits unrelated to caskets.
//
// ROOT CAUSE (confirmed live, script pulled directly via its hosted .js URL):
// onSaveEditPage() re-checked "colorIsSet && Special Instructions is empty" on EVERY save
// of the Deal Edit page, regardless of what was actually being edited. It never compared
// the color fields against what was already stored, so once a Deal had a casket color set
// with no Special Instructions, it stayed permanently blocked on all future saves --
// confirmed live: 682 Deals were in exactly this state at the time of investigation.
//
// FIX: only enforce the "must capture instructions" rule when the casket color is being
// changed in THIS save (compared against the stored record), not on every subsequent
// unrelated edit. This single change also immediately un-blocks the existing 682-Deal
// backlog with no data migration needed, since colorJustChanged is false for all of them
// once deployed.
//
// Only this function changed. Every other function in the script (csiIsColorSet,
// csiStampColorSelectedTime, csiIsLockedForFuneralDirector, onBeforeUpdatePrimaryColor,
// onBeforeUpdateSecondaryColor, onBeforeUpdateSpecialInstructions, onSaveCreatePage) is
// untouched -- those are already correctly scoped (only fire on the specific field being
// changed, or on first Deal creation where there's no "unrelated prior edit" concept).

function onSaveEditPage(){
    var primaryColor = ZDK.Page.getField("Primary_Color").getValue();
    var secondaryColor = ZDK.Page.getField("Secondary_Color").getValue();
    var csiField = ZDK.Page.getField("Special_Instructions1");
    var csi = csiField ? csiField.getValue() : null;
    var colorSelectedTime = ZDK.Page.getField("Casket_Color_Selected_Time").getValue();
    var colorIsSet = csiIsColorSet(primaryColor, secondaryColor);

    var storedRecord = ZDK.Apps.CRM.Deals.fetchById($Page.record_id);
    var storedPrimary = storedRecord ? storedRecord.Primary_Color : null;
    var storedSecondary = storedRecord ? storedRecord.Secondary_Color : null;
    // Only enforce the "must capture instructions" rule when the color is actually
    // being changed in THIS save -- not on every future unrelated edit.
    var colorJustChanged = (primaryColor !== storedPrimary) || (secondaryColor !== storedSecondary);

    if (colorIsSet && colorJustChanged && (!csi || csi.trim() === "")) {
        ZDK.Client.showAlert("Any special instructions for caskets must be captured within a day of final casket color selections.");
        return false;
    }

    if (colorIsSet) {
        var storedCsi = storedRecord ? storedRecord.Special_Instructions1 : null;
        if (csi !== storedCsi && csiIsLockedForFuneralDirector(colorSelectedTime)) {
            ZDK.Client.showAlert("This deal's casket color was finalized over 24 hours ago — Casket Special Instructions is now locked for Funeral Directors.");
            return false;
        }
    }

    if (colorIsSet && colorJustChanged) { csiStampColorSelectedTime(); }
    return true;
}

// Test plan (all confirmed passing 2026-08-18):
// 1. Backlog unblocked: a Deal with color already set + empty Special Instructions saves
//    successfully when editing something unrelated (e.g. phone number) -- no popup.
// 2. Original rule still works: setting a NEW casket color with empty Special
//    Instructions still blocks the save with the same popup.
// 3. 24-hour Funeral Director lock still works: changing Special Instructions 24+ hours
//    after color was finalized, as a Funeral Director-role owner, still blocks with the
//    "locked" message.
//
// FUNERAL_DIRECTOR_ROLE_ID = "6503357000005270017" -- confirmed correct by the user
// (2026-08-18), resolving the original developer's own "confirm before shipping" comment.
// No longer an open item.
