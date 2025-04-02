import {device} from './Device.js';
import { handleConnectionButtonClick, closeModal} from './buggyConnection.js';
import { changeMode, fetchBatteryCommand, updateParameters} from './BuggyCommands.js';
import { updateDebugTable,downloadDebugCSV, generateTrack } from './buggyDebug.js';
import { updateWeights, updateSensorTable,startSensorDebug,stopSensorDebug } from './sensorDebug.js';
import { fetchState } from './BuggyState.js';
import { updateMotorTable, updateSpeeds,startMotorDebug,stopMotorDebug} from './motorDebug.js';
import { updateBatteryDisplay } from './controlPannel.js';
// Fetch state on page load
window.onload = async function () {
    console.log("Page loaded");
};







// ✅ Ensure all event listeners are added *after* the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectButton").addEventListener("click", handleConnectionButtonClick);
    document.getElementById("modeSelect").addEventListener("change", () => {
        changeMode(document.getElementById("modeSelect").value);
    });
    
    document.getElementById("modeSelect-button").addEventListener("click", () => {
        changeMode(document.getElementById("modeSelect").value);
    });    
    document.getElementById("downloadDebugBtn").addEventListener("click", () => {
        downloadDebugCSV(device.debugData);
    });
    document.getElementById("buggyPath").addEventListener("click", () => {
        generateTrack(device.accumulatedDebugData);
    });
    
    // Close modal button
    document.querySelector("#device-selection-modal-close-button").addEventListener("click", closeModal);

    // Button to update parameters
    document.querySelector("#UpdateParameters").addEventListener("click", updateParameters);

    //Update Sensor Weights
    document.querySelector("#updateWeightsButton").addEventListener("click", updateWeights);

    //Update Motor Speeds for Debug
    document.querySelector("#updateSpeedsButton").addEventListener("click", updateSpeeds);

    console.log("✅ Event listeners initialized after DOM load.");
});

// Listen for debug table update
document.addEventListener("updateDebugTable", (event) => {
    updateDebugTable(event.detail);
});
document.addEventListener("updateSensorTable", (event) => {
    const data = event.detail;
    updateSensorTable(data);
});

document.addEventListener("updateMotorTable", (event) => {
    const data = event.detail;
    updateMotorTable(data);
});

// Listen for state fetch request
document.addEventListener("fetchState", () => {
    fetchState();
});

// Listen for "startSensorDebug" event
document.addEventListener("startSensorDebug", () => {
    startSensorDebug();
});

// Listen for "stopSensorDebug" event
document.addEventListener("stopSensorDebug", () => {
    stopSensorDebug();
});

// Listen for "startMotorDebug" event
document.addEventListener("startMotorDebug", () => {
    startMotorDebug();
});

// Listen for "stopMotorDebug" event
document.addEventListener("stopMotorDebug", () => {
    stopMotorDebug();
});

document.addEventListener("updateBatteryInfo", (event) => {
    updateBatteryDisplay(event.detail);
});

// Listen for state fetch request
document.addEventListener("fetchBattery", () => {
    fetchBatteryCommand();
});

document.getElementById("refreshBattery").addEventListener("click", () => {
    fetchBatteryCommand();
});

document.addEventListener("debugStart", () => {
    document.getElementById("mode").innerText = "Recieving Debug Data";
});
