# CRM field change -- Transport module

Not a `.ds` file, so this is a normal Setup UI step (no Creator-editor round trip needed).

## New field: Leg

1. **Setup → Customization → Modules and Fields → Transport** (module display name "Transport",
   api_name `Transport`, internally `CustomModule34`)
2. Add a new field:
   - Type: **Pick List**
   - Field Label: `Leg`
   - API Name: `Leg` (should auto-generate from the label -- confirm it lands exactly as `Leg`,
     matching what all the Deluge functions in this folder expect)
   - Values: `Pickup`, `Dropoff` (no default value -- should stay blank until TM assigns it)
3. Add the field to the Transport module's Standard layout (view + edit + create) so it's visible
   or at least editable directly on the record if anyone needs to fix it by hand.
4. No other field changes needed -- everything else this feature uses (Transport_Status,
   Current_Location, Related_Trip, Category, Additional_Information, Completed_Date_and_Time)
   already exists.
