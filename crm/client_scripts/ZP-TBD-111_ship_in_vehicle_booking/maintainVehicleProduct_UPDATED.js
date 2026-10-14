function maintainVehicleProductDetailsPage(row_data, index)
{
var pipeline = ZDK.Page.getField('Pipeline').getValue();
// ZP-TBD-111: Ship In Deals book their availability-based vehicle the same way
if (pipeline == "Cremation with Service" || pipeline == "Funeral with Burial" || pipeline == "Ship Ins") {
    try{
        var product = ZDK.Page.getSubform('Product_Selection').getRow(index).getCell('Child_Product').getValue();
        var vehicleBookingID = ZDK.Page.getSubform('Product_Selection').getRow(index).getCell('Vehicle_Booking_ID').getValue();
        log(product.id);
        log("vehicleBookingID");
        log(vehicleBookingID);
    }
    catch(error){
        product = null;
    }
    if(product != null){
        
        var product = ZDK.Apps.CRM.Products.fetchById(product.id);
        console.log(product);

        var Availability_Based = product.Availability_Based;
        console.log(Availability_Based);

        if (Availability_Based == true) {
            //var Funeral_Time = ZDK.Page.getField('Funeral_Time');
            var Funeral_Time_Value = ZDK.Page.getField('Funeral_Time').getValue();
            if (Funeral_Time_Value == null) {
                var cell_obj = ZDK.Page.getSubform('Product_Selection').getRow(index).getCell('Child_Product');
                var row_obj = ZDK.Page.getSubform('Product_Selection').getRow(index);
                ZDK.Client.showAlert("Please Provide Funeral Date and Time");
                return false;
                //ZDK.Page.getSubform('Product_Selection').deleteRow(index);
            } else {
                try {
                    // Convert to Date object
                    let funeralTimeDate = new Date(Funeral_Time_Value);
    // Now you can safely use toISOString()
                    let isoDate = funeralTimeDate.toISOString(); 
                    let formatted = formatDateTimeForZoho(Funeral_Time_Value);

                    var onlyDate = formatted.dateOnly;      // 2026-01-09
                    var exactValue = formatted.dateTime;  // 2026-01-09T11:00:00+06:00

                    var parametersCOQL = {
                        select_query: `select Name, Deal, Vehicle
                                    from Vehicle_Bookings
                                    where
                                        (Deal.id != '${$Page.record_id}'
                                        and Start between '${onlyDate}T00:00:00-05:00'
                                        and '${onlyDate}T23:59:59-05:00')
                                        and Vehicle.id ='${product.id}'`
                    };

                    var responseCOQL = ZDK.Apps.CRM.Connections.invoke(
                        "zohooauth",
                        "https://www.zohoapis.com/crm/v6/coql",
                        "POST",
                        2,
                        parametersCOQL,
                        {}
                    );

                    console.log("parametersCOQL:", parametersCOQL);
                    console.log("COQL response:", responseCOQL);

                    // --------------------
                    // SAFE RESULT CHECK
                    // --------------------
                    var statusMessage = responseCOQL?._details?.statusMessage;

                    if (
                        statusMessage &&
                        typeof statusMessage === "object" &&
                        Array.isArray(statusMessage.data) &&
                        statusMessage.data.length > 0
                    ) {
                        ZDK.Client.showAlert("This vehicle is already scheduled for another service on this day.  Please check the vehicle calendar for a new date or select a different vehicle");
                        return false;
                        //console.log("Found contacts:", searchResults);
                        // Perform actions with the found records, e.g., display a message, populate fields
                    } else {
                        //console.log("No contacts found with that email.");
                        var Name_of_Deceased = ZDK.Page.getField('Name_of_Deceased').getValue();
                        console.log(Name_of_Deceased);
                        
                        // let taskData = {
                        //         Name: Name_of_Deceased,
                        //         Vehicle: product.id,
                        //         Start: exactValue,
                        //         End: exactValue,
                        //         Status: "Confirmed",
                        //         Calendar_View_enabled: true
                        // };
                        //ZDK.CRM.createRecord("Vehicle_Bookings", taskData);

                        var taskData = {
                            "data": [
                                {
                            
                                    "Name": product.Product_Name+" "+Funeral_Time_Value+" "+ Name_of_Deceased,
                                    "Vehicle": {
                                        "id": product.id
                                    },
                                    "Deal": {
                                        "id": $Page.record_id
                                    },
                                    "Start": exactValue,
                                    "End": exactValue,
                                    "Status": "Confirmed",
                                    "Calendar_View_enabled": true,
                                    "Note": product.Product_Name+" "+Funeral_Time_Value+" "+ Name_of_Deceased
                        
                                
                        }
                            ],
                            "trigger": [
                                "workflow"
                            ]
                        };
                        if( vehicleBookingID === null ){
                            res = ZDK.Apps.CRM.Connections.invoke("zohooauth", "https://www.zohoapis.com/crm/v8/Vehicle_Bookings", "POST", 2, taskData, {});
                            var row_obj = ZDK.Page.getSubform('Product_Selection').getRow(index);
                            try{
                                row_obj.getCell("Vehicle_Booking_ID").setValue(res._details.statusMessage.data[0].details.id);
                            }catch(error){
                                console.log(error);
                            }
                        }else{
                            res = ZDK.Apps.CRM.Connections.invoke("zohooauth", "https://www.zohoapis.com/crm/v8/Vehicle_Bookings/"+vehicleBookingID, "PUT", 2, taskData, {});
                        }
                        console.log("res");
                        console.log(res);
                    }
                } catch (error) {
                    console.error("Error searching for contacts:", error);
                }
            }
            //Funeral_Time.setMandatory(true);
        }else{
            if( vehicleBookingID !== null ){//|| product.id == "6503357000062770001"

                // if( product.id == "6503357000062770001" ){
                //     var Funeral_Time_Value = ZDK.Page.getField('Funeral_Time').getValue();
                //     if (Funeral_Time_Value == null) {
                //         ZDK.Client.showAlert("Please Provide Funeral Date and Time");
                //         return false;
                //         //ZDK.Page.getSubform('Product_Selection').deleteRow(index);
                //     }
                // }

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

    console.log(Funeral_Time_Value);
}
console.log(pipeline);
return true;

function formatDateTimeForZoho(dateTimeStr) {
    let date = new Date(dateTimeStr); // Convert string from CRM to Date object

    let pad = (n) => n.toString().padStart(2, '0');
    let year = date.getFullYear();
    let month = pad(date.getMonth() + 1);
    let day = pad(date.getDate());
    let hours = pad(date.getHours());
    let minutes = pad(date.getMinutes());
    let seconds = pad(date.getSeconds());

    // Local timezone offset in minutes (negative for ahead of UTC)
    let offsetMinutes = -date.getTimezoneOffset();
    let sign = offsetMinutes >= 0 ? "+" : "-";
    let absOffset = Math.abs(offsetMinutes);
    let offsetHours = pad(Math.floor(absOffset / 60));
    let offsetMins = pad(absOffset % 60);

    return {
        dateOnly: `${year}-${month}-${day}`,
        dateTime: `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`
    };
}

}