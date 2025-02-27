import ConnectionManager from './connectionManager.js';

const connectionManager = new ConnectionManager();

// Fetch state on page load
window.onload = async function () {
    console.log("Page loaded");
};

function showConnectionOptions() {
    document.getElementById("overlay").style.display = "block";
    document.getElementById("device-selection-modal").style.display = "block";

    const container = document.getElementById("device-list");
    container.innerHTML = ""; // Clear previous entries

    const bleButton = document.createElement("button");
    bleButton.innerText = "Connect via Bluetooth";
    bleButton.onclick = async () => {
        await connectionManager.scanBLE();
        handleConnectionSuccess();
    };
    container.appendChild(bleButton);

    const serialButton = document.createElement("button");
    serialButton.innerText = "Connect via Serial";
    serialButton.onclick = async () => {
        await connectionManager.scanSerial();
        handleConnectionSuccess();
    };
    container.appendChild(serialButton);
}

function closeModal() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("device-selection-modal").style.display = "none";
}

function handleConnectionSuccess() {
    if (connectionManager.isConnected) {
        closeModal();
        updateConnectionButton();
        fetchState();
    }
}

// Update the UI when connection status changes
function updateConnectionButton() {
    const button = document.getElementById("connectButton");
    if (connectionManager.isConnected) {
        button.innerText = "Disconnect";
    } else {
        button.innerText = "Connect to Buggy";
    }
}

function handleConnectionButtonClick() {
    if (connectionManager.isConnected) {
        disconnectDevice();
    } else {
        showConnectionOptions();
    }
}


// Disconnect from the current device
async function disconnectDevice() {
    console.log("Disconnecting from device");
    await connectionManager.disconnect();
    updateConnectionButton();
}

async function fetchState() {
    console.log("Fetching state and parameters");

    await connectionManager.sendCommandAndWait("STATE", "MODE:", 9000);
    await connectionManager.sendCommandAndWait("PARAMETER", "PARAMETERS_DONE", 9000);

    updateUI();
}

function updateUI() {
    console.log("Updating UI with state:", connectionManager.buggyState);

    // Update mode
    document.getElementById("mode").innerText = connectionManager.buggyState.mode;

    // Get the parameters div
    const paramDiv = document.getElementById("parameters");
    if (!paramDiv) {
        console.error("❌ ERROR: Parameters div not found!");
        return;
    }

    // Clear the parameter list
    paramDiv.innerHTML = "";

    // Ensure parameters exist before updating UI
    if (!connectionManager.buggyState.parameters || Object.keys(connectionManager.buggyState.parameters).length === 0) {
        console.warn("⚠️ No parameters to display.");
        return;
    }

    console.log("Parameters received:", connectionManager.buggyState.parameters);

    // Store the current parameters state for change detection
    connectionManager.initialParameters = { ...connectionManager.buggyState.parameters };

    // Add input fields for each parameter
    Object.entries(connectionManager.buggyState.parameters).forEach(([key, value]) => {
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
            await connectionManager.sendCommandAndWait(
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
    connectionManager.lastRunMode = connectionManager.mode;
    connectionManager.lastRunParameters = { ...connectionManager.buggyState.parameters };

    console.log("📌 Stored mode & parameters for debug:", connectionManager.lastRunMode, connectionManager.lastRunParameters);

    try {
        await connectionManager.sendCommandAndWait("GO", "STARTING MOVEMENT", 100000);
        console.log("✅ Movement started");
        fetchState();
    } catch (error) {
        console.error("❌ Error starting movement:", error);
        alert("Failed to start movement");
    }
}


async function changeMode() {
    if (!connectionManager.isConnected) {
        alert("Please connect to a device first.");
        return;
    }

    const selectedMode = document.getElementById("modeSelect").value;
    console.log(`Changing mode to: ${selectedMode}`);

    try {
        await connectionManager.sendCommandAndWait(`SET_MODE:${selectedMode}`, new RegExp(`MODE_CHANGED:${selectedMode}`), 5000);
        console.log(`✅ Mode changed to ${selectedMode}`);
    } catch (error) {
        console.error("❌ Error changing mode:", error);
        alert("Failed to change mode");
        return;
    }

    fetchState();
}


connectionManager.onMessageReceived = (message) => {
    console.log("Received message from buggy:", message);
    if (message.includes("MOVEMENT FINISHED")) {
        console.log("Movement finished detected");
        fetchState();
    } else if (message.startsWith("DEBUG DATA:")) {
        console.log("Debug data detected, fetching debug data");
        fetchDebugData();
    }
};

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
    modeUsed.innerText = connectionManager.lastRunMode || "Unknown";

    // Format parameters as key-value pairs without quotes
    const params = connectionManager.lastRunParameters || {};
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

    const modeUsed = connectionManager.lastRunMode || "Unknown";
    const parametersUsed = JSON.stringify(connectionManager.lastRunParameters || {});

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


// ✅ Ensure all event listeners are added *after* the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectButton").addEventListener("click", handleConnectionButtonClick);
    document.getElementById("modeSelect").addEventListener("change", changeMode);
    document.getElementById("modeSelect-button").addEventListener("click", changeMode);
    document.getElementById("downloadDebugBtn").addEventListener("click", () => {
        downloadDebugCSV(connectionManager.accumulatedDebugData);
    });
    
    // Close modal button
    document.querySelector("#device-selection-modal-close-button").addEventListener("click", closeModal);

    // Button to update parameters
    document.querySelector("#UpdateParameters").addEventListener("click", updateParameters);

    // Start buggy button
    document.querySelector("#Start-button").addEventListener("click", startBuggy);

    console.log("✅ Event listeners initialized after DOM load.");
});

// Listen for debug table update
document.addEventListener("updateDebugTable", (event) => {
    updateDebugTable(event.detail);
});

// Listen for state fetch request
document.addEventListener("fetchState", () => {
    fetchState();
});