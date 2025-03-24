import Device from './Device.js';
import UIHandler from './StatusUiHandler.js';
const device = new Device();

// Fetch state on page load
window.onload = async function () {
    console.log("Page loaded");
};

const uiHandler = new UIHandler();
// Subscribe to events
device.connectionManager.on("connectionStatus", (status) => {
    uiHandler.updateConnectionStatus(status.type, status.status);
});


function showConnectionOptions() {
    document.getElementById("overlay").style.display = "block";
    document.getElementById("device-selection-modal").style.display = "block";

    const container = document.getElementById("device-list");
    container.innerHTML = ""; // Clear previous entries

    const bleButton = document.createElement("button");
    bleButton.innerText = "Connect via Bluetooth";
    bleButton.onclick = async () => {
        await device.scanBLE();
        handleConnectionSuccess();
    };
    container.appendChild(bleButton);

    const serialButton = document.createElement("button");
    serialButton.innerText = "Connect via Serial";
    serialButton.onclick = async () => {
        await device.scanSerial();
        handleConnectionSuccess();
    };
    container.appendChild(serialButton);
}

function closeModal() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("device-selection-modal").style.display = "none";
}

function handleConnectionSuccess() {
    if (device.isConnected) {
        closeModal();
        updateConnectionButton();
        fetchState();
    }
}

// Update the UI when connection status changes
function updateConnectionButton() {
    const button = document.getElementById("connectButton");
    if (device.isConnected) {
        button.innerText = "Disconnect";
    } else {
        button.innerText = "Connect to Buggy";
    }
}

function handleConnectionButtonClick() {
    if (device.isConnected) {
        disconnectDevice();
    } else {
        showConnectionOptions();
    }
}


// Disconnect from the current device
async function disconnectDevice() {
    console.log("Disconnecting from device");
    await device.disconnect();
    updateConnectionButton();
}

async function fetchState() {
    console.log("Fetching state and parameters");

    await device.sendCommandAndWait("STATE", "MODE:", 9000);
    await device.sendCommandAndWait("PARAMETER", "PARAMETERS_DONE", 9000);

    updateUI();
}

function updateUI() {
    console.log("Updating UI with state:", device.buggyState);

    // Update mode
    document.getElementById("mode").innerText = device.buggyState.mode;

    // Get the parameters div
    const paramDiv = document.getElementById("parameters");
    if (!paramDiv) {
        console.error("❌ ERROR: Parameters div not found!");
        return;
    }

    // Clear the parameter list
    paramDiv.innerHTML = "";

    // Ensure parameters exist before updating UI
    if (!device.buggyState.parameters || Object.keys(device.buggyState.parameters).length === 0) {
        console.warn("⚠️ No parameters to display.");
        return;
    }

    console.log("Parameters received:", device.buggyState.parameters);

    // Store the current parameters state for change detection
    device.initialParameters = { ...device.buggyState.parameters };

    // Add input fields for each parameter
    Object.entries(device.buggyState.parameters).forEach(([key, value]) => {
        console.log(`Adding parameter: ${key} = ${value}`);

        const paramRow = document.createElement("div");
        paramRow.classList.add("parameter-item"); // Add the class for styling

        const input = document.createElement("input");
        input.type = "text";
        input.id = `param-${key}`;
        input.value = value;
        input.dataset.initial = value; // Store initial value for comparison
        input.style.color = "gray"; // Start with gray text

        // Change color when the user edits the field
        input.addEventListener("input", () => {
            input.style.color = (input.value.trim() === input.dataset.initial) ? "gray" : "black";
        });

        const label = document.createElement("label");
        label.innerText = `${key}: `;

        paramRow.appendChild(label);
        paramRow.appendChild(input);
        paramDiv.appendChild(paramRow);
    });
}

async function updateParameters() {
    console.log("Checking for parameter updates");
    const paramInputs = document.querySelectorAll("#parameters input");
    let updates = [];

    paramInputs.forEach(input => {
        const key = input.id.replace("param-", "");
        const newValue = input.value.trim();
        const initialValue = input.dataset.initial;

        const parsedValue = isNaN(newValue) ? newValue : parseFloat(newValue);
        const parsedInitialValue = isNaN(initialValue) ? initialValue : parseFloat(initialValue);

        if (parsedValue !== parsedInitialValue) {
            updates.push({ key, value: parsedValue });
        }
    });

    if (updates.length === 0) {
        console.log("No changes detected in parameters");
        alert("No changes made.");
        return;
    }

    for (const { key, value } of updates) {
        console.log(`Sending parameter update: ${key}=${value}`);

        try {
            await device.sendCommandAndWait(
                `PARAM:${key}=${value}`,
                new RegExp(`Updated:\\s*${key}\\s*=\\s*${value}`), 
                5000
            );
            console.log(`✅ Confirmed update for ${key}=${value}`);
        } catch (error) {
            console.error(`❌ Error updating ${key}:`, error);
            alert(`Failed to update ${key}`);
            return;
        }
    }

    alert("All parameters updated!");

    // Reset all input colors to gray after update
    paramInputs.forEach(input => {
        input.dataset.initial = input.value; // Update stored initial value
        input.style.color = "gray"; // Reset color
    });

    fetchState();
}


async function startBuggy() {
    console.log("Starting buggy movement");
    document.getElementById("mode").innerText = "waiting_for_movement";

    // Store the mode and parameters when "GO" is pressed
    device.lastRunMode = device.buggyState.mode;
    device.lastRunParameters = { ...device.buggyState.parameters };

    console.log("📌 Stored mode & parameters for debug:", device.lastRunMode, device.lastRunParameters);

    try {
        await device.sendCommandAndWait("GO", "STARTING MOVEMENT", 100000);
        console.log("✅ Movement started");
    } catch (error) {
        console.error("❌ Error starting movement:", error);
        alert("Failed to start movement");
    }
}


async function changeMode() {
    if (!device.isConnected) {
        alert("Please connect to a device first.");
        return;
    }

    const selectedMode = document.getElementById("modeSelect").value;
    console.log(`Changing mode to: ${selectedMode}`);

    try {
        await device.sendCommandAndWait(`SET_MODE:${selectedMode}`, new RegExp(`MODE_CHANGED:${selectedMode}`), 5000);
        console.log(`✅ Mode changed to ${selectedMode}`);

        // If sensor debug mode is selected, start fetching sensor data
        if (selectedMode === "SENSOR_DEBUG") {
            startSensorDebug();
        }else {
            stopSensorDebug();
        }

    } catch (error) {
        console.error("❌ Error changing mode:", error);
        alert("Failed to change mode");
        return;
    }

    fetchState();
}


function updateDebugTable(accumulatedDebugData) {
    const table = document.querySelector("#debugTable");
    if (!table) {
        console.error("❌ ERROR: Debug table not found!");
        return;
    }

    const modeUsed = document.querySelector("#modeUsed");
    const parametersUsed = document.querySelector("#parametersUsed");

    if (!table) {
        console.error("❌ ERROR: Debug table not found!");
        return;
    }

    // Update mode info
    modeUsed.innerText = device.lastRunMode || "Unknown";

    // Format parameters as key-value pairs without quotes
    const params = device.lastRunParameters || {};
    const formattedParams = Object.entries(params)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
    
    parametersUsed.innerText = formattedParams || "N/A";

    if (!accumulatedDebugData || accumulatedDebugData.length === 0) {
        console.warn("⚠️ No debug data available.");
        table.innerHTML = "<tr><th>No Data</th></tr>";
        return;
    }

    // Extract all unique keys from debug data
    const allKeys = new Set();
    accumulatedDebugData.forEach(data => Object.keys(data).forEach(key => allKeys.add(key)));

    const headers = Array.from(allKeys);

    // Update Table Headers
    const tableHead = table.querySelector("thead");
    tableHead.innerHTML = "<tr>" + headers.map(header => `<th>${header}</th>`).join("") + "</tr>";

    // Update Table Body
    const tableBody = table.querySelector("tbody");
    tableBody.innerHTML = accumulatedDebugData.map(data => 
        `<tr>${headers.map(header => `<td>${data[header] || ""}</td>`).join("")}</tr>`
    ).join("");

    fetchState();
}


function downloadDebugCSV(accumulatedDebugData) {
    if (!accumulatedDebugData || accumulatedDebugData.length === 0) {
        console.warn("⚠️ No debug data available to download.");
        alert("No debug data to download.");
        return;
    }

    const modeUsed = device.lastRunMode || "Unknown";
    const parametersUsed = JSON.stringify(device.lastRunParameters || {});

    // Extract all unique keys from debug data
    const allKeys = new Set();
    accumulatedDebugData.forEach(data => Object.keys(data).forEach(key => allKeys.add(key)));
    const headers = Array.from(allKeys);

    let csvContent = `Mode Used: ${modeUsed}\nParameters Used: ${parametersUsed}\n\n`; // Add mode & parameters at the top
    csvContent += headers.join(",") + "\n"; // Column headers

    accumulatedDebugData.forEach(data => {
        let row = headers.map(header => `"${(data[header] ?? "").toString().replace(/"/g, '""')}"`).join(",");
        csvContent += row + "\n";
    });

    // Generate a filename with mode name
    const fileName = `debug_${modeUsed}_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;

    // Create and download the CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    console.log(`📥 Debug data downloaded as CSV: ${fileName}`);
}




async function startSensorDebug() {
    console.log("Entering Sensor Debug Mode...");

    try {
        // Show the sensor data container
        document.getElementById("sensorDataContainer").style.display = "block";

        // Update the debug status text
        document.getElementById("sensorDebugStatus").innerText = "ON";
        document.getElementById("sensorDebugStatus").style.color = "green";

        console.log("✅ Sensor Debug Mode Activated");
    } catch (error) {
        console.error("❌ Error starting sensor debug mode:", error);
    }
}

async function stopSensorDebug() {
    console.log("Exiting Sensor Debug Mode...");

    try {
        // Hide the sensor data container
        document.getElementById("sensorDataContainer").style.display = "none";

        // Update the debug status text
        document.getElementById("sensorDebugStatus").innerText = "OFF";
        document.getElementById("sensorDebugStatus").style.color = "red";

        console.log("✅ Sensor Debug Mode Deactivated");
    } catch (error) {
        console.error("❌ Error stopping sensor debug mode:", error);
    }
}


// Object to store user-defined sensor weights
const sensorWeights = new Array(6).fill(1); // Default all weights to 1

function updateSensorTable(sensorData) {

    const timeElapsed = sensorData.time;
    const sensorValues = sensorData.sensors;
    const errorValue = sensorData.error;

    // ---- Update Line Detection Status ----
    const lineStatus = document.getElementById("lineStatus");
    if (errorValue === 999.0) {
        lineStatus.innerText = "Line Not Found";
        lineStatus.style.color = "red";
    } else {
        lineStatus.innerText = "Line Detected";
        lineStatus.style.color = "green";
    }

    // Get table body and bar graph container
    const tableBody = document.querySelector("#sensorDataTable tbody");
    const sensorBarContainer = document.getElementById("sensorBarContainer");


    // ---- Update Raw Data Table ----
    tableBody.innerHTML = ""; // Clear previous rows (only show latest)
    const row = document.createElement("tr");

    // Time Column
    const timeCell = document.createElement("td");
    timeCell.innerText = timeElapsed;
    row.appendChild(timeCell);

    // Sensor Value Columns
    sensorValues.forEach(value => {
        const cell = document.createElement("td");
        cell.innerText = parseFloat(value).toFixed(2);
        row.appendChild(cell);
    });

    // Error Column
    const errorCell = document.createElement("td");
    errorCell.innerText = errorValue.toFixed(2);
    errorCell.style.color = "red";
    row.appendChild(errorCell);

    // Append row to table
    tableBody.appendChild(row);

    // ---- Update Bar Graph ----
    sensorBarContainer.innerHTML = ""; // Clear previous bars
    const maxSensorValue = 3.30; // Set the known max value

    sensorValues.forEach((value, index) => {
        const container = document.createElement("div");
        container.className = "bar-container";

        // Background max bar (gray box)
        const maxBar = document.createElement("div");
        maxBar.className = "max-bar";

        // Actual sensor value bar (blue)
        const bar = document.createElement("div");
        bar.className = "sensor-bar";

        // Scale height using known max value (3.30)
        let heightPercent = (value / maxSensorValue) * 100;
        if (heightPercent < 5) heightPercent = 5; // Ensure small values are visible

        bar.style.height = `${heightPercent}%`;
        bar.innerText = value.toFixed(2);

        // Append elements properly
        container.appendChild(maxBar);
        container.appendChild(bar);
        sensorBarContainer.appendChild(container);
    });


    // ---- Update Line Estimation on Canvas ----
    // Get canvas and context
    const canvas = document.getElementById("sensorCanvas");
    const ctx = canvas.getContext("2d");

    // Set canvas size dynamically
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 250;

    const width = canvas.width;
    const height = canvas.height;
    const midHeight = height / 2;

    // Sensor positions in mm (centered at 0mm)
    const sensorPositions = [-50, -30, -10, 10, 30, 50]; // mm positions

    // Convert mm to pixels
    const mmToPixel = width / 100; // Since range is from -50mm to 50mm

    // ---- Draw Sensor Position Indicators ----
    ctx.strokeStyle = "lightgray";
    ctx.lineWidth = 1;
    ctx.font = "12px Arial";
    ctx.fillStyle = "black";

    sensorPositions.forEach((pos, index) => {
        let xPos = (pos + 50) * mmToPixel; // Shift -50mm → 0px, 50mm → width

        // Draw vertical line for sensor position
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, height);
        ctx.stroke();

        // Label the sensor position
        ctx.fillText(`S${index}`, xPos - 8, height - 5); // Offset text for better alignment
    });

    // ---- Draw Baseline ----
    ctx.strokeStyle = "gray";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, midHeight);
    ctx.lineTo(width, midHeight);
    ctx.stroke();

    // ---- Calculate Weighted Line Position ----
    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < sensorValues.length; i++) {
        const weightedValue = sensorValues[i] * sensorWeights[i];
        weightedSum += sensorPositions[i] * weightedValue;
        totalWeight += weightedValue;
    }

    // Compute estimated line position in mm
    let estimatedLinePosMM = (weightedSum / totalWeight) || 0; // Default to center if no weight

    // Convert mm position to canvas pixels
    let lineX = (estimatedLinePosMM + 50) * mmToPixel; // Shift -50mm → 0px, 50mm → width

    // ---- Draw Estimated Line Position ----
    if (errorValue !== 999.0) {
        const lineWidthMM = 17; // The width of the detected line in mm
        const lineHalfWidthPixels = (lineWidthMM / 2) * mmToPixel; // Convert to pixels

        // Draw semi-transparent line region (wider representation of the detected line)
        ctx.fillStyle = "rgba(255, 0, 0, 0.3)"; // Red with transparency
        ctx.fillRect(lineX - lineHalfWidthPixels, 0, lineHalfWidthPixels * 2, height);

        // Draw solid centerline
        ctx.strokeStyle = "red";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lineX, 0);
        ctx.lineTo(lineX, height);
        ctx.stroke();
    }

}

// Function to update weights from user input
function updateWeights() {
    document.querySelectorAll(".weight-input").forEach((input, index) => {
        sensorWeights[index] = parseFloat(input.value) || 1;
    });
}



// ✅ Ensure all event listeners are added *after* the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectButton").addEventListener("click", handleConnectionButtonClick);
    document.getElementById("modeSelect").addEventListener("change", changeMode);
    document.getElementById("modeSelect-button").addEventListener("click", changeMode);
    document.getElementById("downloadDebugBtn").addEventListener("click", () => {
        downloadDebugCSV(device.accumulatedDebugData);
    });
    
    // Close modal button
    document.querySelector("#device-selection-modal-close-button").addEventListener("click", closeModal);

    // Button to update parameters
    document.querySelector("#UpdateParameters").addEventListener("click", updateParameters);

    // Start buggy button
    document.querySelector("#Start-button").addEventListener("click", startBuggy);

    document.querySelector("#updateWeightsButton").addEventListener("click", updateWeights);


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

// Listen for state fetch request
document.addEventListener("fetchState", () => {
    fetchState();
});