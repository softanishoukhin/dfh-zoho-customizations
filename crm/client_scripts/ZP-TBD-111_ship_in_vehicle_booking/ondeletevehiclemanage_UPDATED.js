function onDeleteVehicleManage(row_data, index){
var pipeline = ZDK.Page.getField('Pipeline').getValue();
// ZP-TBD-111: Ship In Deals book their availability-based vehicle the same way
if (pipeline == "Cremation with Service" || pipeline == "Funeral with Burial" || pipeline == "Ship Ins") {
    var vehicleBookingID = ZDK.Page.getSubform('Product_Selection').getRow(index).getCell('Vehicle_Booking_ID').getValue();
    if( vehicleBookingID !== null ){
        vehicleBookingInfo = ZDK.Apps.CRM.Connections.invoke("zohooauth", "https://www.zohoapis.com/crm/v8/Vehicle_Bookings/"+vehicleBookingID, "GET", 2, {}, {});
        try{
            calendarEventUID = vehicleBookingInfo._details.statusMessage.data[0].Calendar_Event_UID;
            calendarEventDetails = ZDK.Apps.CRM.Connections.invoke("zohooauth", "https://calendar.zoho.com/api/v1/calendars/96ad489318f1477bb552861bc8dac057/events/"+calendarEventUID+"?byinstance=true", "GET", 2, {}, {});
            try{
                etag = calendarEventDetails._details.statusMessage.events[0].etag;
                eventdata=
                {
                    "uid":calendarEventUID,
                    "etag": etag
                }
                deleteCalendarEvent = ZDK.Apps.CRM.Connections.invoke("zohooauth", "https://calendar.zoho.com/api/v1/calendars/96ad489318f1477bb552861bc8dac057/events/"+calendarEventUID, "DELETE", 2, eventdata, {"etag": etag});
            }catch(errorEtag){
                console.log( errorEtag );
            }

            deleteVehicleBookings = ZDK.Apps.CRM.Connections.invoke("zohooauth", "https://www.zohoapis.com/crm/v8/Vehicle_Bookings/"+vehicleBookingID, "DELETE", 2, {}, {});

            console.log("deleteVehicleBookings");
            console.log(deleteVehicleBookings);

            var row_obj = ZDK.Page.getSubform('Product_Selection').getRow(index);
            try{
                row_obj.getCell("Vehicle_Booking_ID").setValue("");
            }catch(error){
                console.log(error);
            }                
        }
        catch(error){
            console.log(error);
        }
    }
}
}