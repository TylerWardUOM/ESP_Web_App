export async function startSensorDebug() {
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

export async function stopSensorDebug() {
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

export function updateSensorTable(sensorData) {

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
export function updateWeights() {
    document.querySelectorAll(".weight-input").forEach((input, index) => {
        sensorWeights[index] = parseFloat(input.value) || 1;
    });
}

