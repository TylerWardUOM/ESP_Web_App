import {device} from './Device.js';
import { handleConnectionButtonClick, closeModal} from './buggyConnection.js';
import { changeMode, updateParameters, startBuggy, turnAroundCommand, stopCommand} from './BuggyCommands.js';
import { updateDebugTable,downloadDebugCSV, generateTrack } from './buggyDebug.js';
import { updateWeights, updateSensorTable } from './sensorDebug.js';
import { fetchState } from './BuggyState.js';
import { updateMotorTable, updateSpeeds} from './motorDebug.js';
// Fetch state on page load
window.onload = async function () {
    console.log("Page loaded");
};







// ✅ Ensure all event listeners are added *after* the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectButton").addEventListener("click", handleConnectionButtonClick);
    document.getElementById("modeSelect").addEventListener("change", changeMode);
    document.getElementById("modeSelect-button").addEventListener("click", changeMode);
    document.getElementById("downloadDebugBtn").addEventListener("click", () => {
        downloadDebugCSV(device.accumulatedDebugData);
    });
    document.getElementById("buggyPath").addEventListener("click", () => {
        generateTrack(device.accumulatedDebugData);
    });
    
    // Close modal button
    document.querySelector("#device-selection-modal-close-button").addEventListener("click", closeModal);

    // Button to update parameters
    document.querySelector("#UpdateParameters").addEventListener("click", updateParameters);

    // Start buggy button
    document.querySelector("#Start-button").addEventListener("click", startBuggy);

    // Turn Around Button
    document.querySelector("#Turn-Around-button").addEventListener("click", turnAroundCommand);

    // Stop Button
    document.querySelector("#Stop-button").addEventListener("click", stopCommand);

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

