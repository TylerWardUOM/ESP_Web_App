import { device } from "./Device.js";
import { updateUI } from "./controlPannel.js";

export async function fetchState() {
    console.log("Fetching state and parameters");

    if (device.isConnected) {
        document.getElementById("controls").style.display = "block";
        
        try {
            await device.sendCommandAndWait("STATE", "MODE:", 9000);
            await device.sendCommandAndWait("PARAMETER", "PARAMETERS_DONE", 9000);
            updateUI();
        } catch (error) {
            console.error("❌ Error fetching state:", error);
            alert("Failed to fetch state: " + error.message);  // Show error to user
        }
    }
}