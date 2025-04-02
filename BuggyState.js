import { fetchBatteryCommand } from "./BuggyCommands.js";
import { device } from "./Device.js";
import { updateUI } from "./controlPannel.js";

export async function fetchState() {
    console.log("Fetching state and parameters");

    if (device.isConnected) {
        document.getElementById("controls").style.display = "block";
        
        try {
            await device.sendCommandAndWait("STATE", "MODE:", 9000);
            await device.sendCommandAndWait("PARAMETER", "PARAMETERS_DONE", 9000);
            // Store the current parameters state for change detection
            device.initialParameters = { ...parameters };
            updateUI(device.buggyState.mode,device.buggyState.parameters);
        } catch (error) {
            console.error("❌ Error fetching state:", error);
            //alert("Failed to fetch state: " + error.message);  // Show error to user
        }
    }
}