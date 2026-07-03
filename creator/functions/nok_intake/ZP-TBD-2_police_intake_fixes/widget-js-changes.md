# Companion client-side change (not Deluge)

File: `NOKIntake/app/app.js` (widget JavaScript, not a Zoho function)

The widget's own client-side `validate()` also blocked submission for Police with a blank
Deceased Name, independently of the server-side DS validation fixed in `function.deluge` in
this folder. Both had to be fixed — the client-side check runs first and would have blocked
the request before it ever reached the form's own validation.

```js
// BEFORE
// Deceased Name: required for every deal type EXCEPT Hospital (a hospital
// pickup with no name yet is allowed -- it only creates a Trip).
if (t !== 'Hospital' && !v('Deceased_Name')){
  fail('Deceased_Name', "Deceased Name is required.");
}

// AFTER
// Deceased Name: required for every deal type EXCEPT Hospital and Police (a
// hospital/police pickup with no name yet is allowed -- it only creates a Trip).
if (t !== 'Hospital' && t !== 'Police' && !v('Deceased_Name')){
  fail('Deceased_Name', "Deceased Name is required.");
}
```

Confirmed via connector that `Deceased_Name` has no `mandatory` attribute at the Creator
schema level in either place it's defined in the form — so no schema/field-level change was
needed, only these two validation call sites (this widget JS + the form's on-validate script).
