# ZP-TBD-35 — Remove the manual reschedule Task

Requested by Andrea (`PH_Billing process and Workflows.docx`): *"Please remove the task
that is generated for this. We want billing to be automated, so remove the section of
code that creates a task for follow up."* Pinpointed exactly in the 2026-08-19 code map;
this guideline is the actual removal diff. No dependency on Andrea or any other open
item -- billing (trip creation + Reschedule Trip fee) is fully self-contained above this
block and is untouched by removing it.

Live-verified 2026-08-20 against `automation.handleAutopsyReschedule` (id
`6503357000078744177`).

## The change

Find (the last block in the function, after the billing block and the `isXray` early
return):
```deluge
// Task for Ms. Shirley -- manual invoice, since the system can't reliably tell
// officer-no-show from family-no-show (Andrea's design decision, confirmed 2026-08-13).
// FIX (live test, 2026-08-15): owner is Caeren Shirley specifically (id
// 6503357000009256001, cas@dfhja.com), not the Deal's owner. Also: idempotent -- if a
// task for this exact Deal + Subject already exists, do NOT create a second one; a
// re-fire of the same reschedule reason on the same Deal must reuse the existing task,
// not spawn a duplicate.
taskSubject = "Raise manual reschedule invoice -- decide police-officer vs family charge";
existingTaskCriteria = "(What_Id:equals:" + crmid + ")and(Subject:equals:" + taskSubject + ")";
existingTasks = List();
try
{
	existingTasks = zoho.crm.searchRecords("Tasks",existingTaskCriteria,1,1);
}
catch (eTaskSearch)
{
	existingTasks = List();
}
if(existingTasks.size() == 0)
{
	taskMap = Map();
	taskMap.put("Subject",taskSubject);
	taskMap.put("$se_module","Deals");
	taskMap.put("What_Id",crmid);
	taskMap.put("Owner","6503357000009256001");
	// Caeren Shirley
	taskMap.put("Due_Date",zoho.currentdate.addDay(2));
	taskMap.put("Status","Not Started");
	taskMap.put("Send_Notification_Email",true);
	taskMap.put("Task_Type","Reschedule Manual Invoice");
	createTask = zoho.crm.createRecord("Tasks",taskMap);
	info createTask;
}
else
{
	info "Task already exists for this Deal (" + existingTasks.get(0).get("id") + ") -- not creating a duplicate.";
}
```
Delete this entire block. Nothing needs to replace it -- it's the last statement in the
function, so the function simply ends after the `isXray` early return and the billing
block above it.

## Test

1. Trigger a driver-app "Autopsy not done" reschedule on a test Deal -- confirm the
   Reschedule Trip fee still bills correctly (unchanged from before) and confirm **no**
   Task is created on the Deal anymore.
2. Trigger an X-ray reschedule -- confirm behavior is unchanged (it already never created
   a Task, since it returns before reaching this block).
3. Confirm the trip creation/update logic earlier in the function is completely
   unaffected -- this removal touches nothing above the billing block.
