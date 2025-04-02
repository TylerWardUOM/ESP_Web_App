import { device } from "./Device.js";

export function updateDebugTable(debugData) {
    console.log("Updating Debug Table With:", debugData);
    const tableContainer = document.querySelector("#debugData");
    if (!tableContainer) {
        console.error("❌ ERROR: Debug data container not found!");
        return;
    }

    const modeUsed = document.querySelector("#modeUsed");
    const parametersUsed = document.querySelector("#parametersUsed");
    const table = document.querySelector("#debugTable");

    if (!table) {
        console.error("❌ ERROR: Debug table not found!");
        return;
    }

    // Show last run details
    document.getElementById("lastRunData").style.display = "block";
    modeUsed.innerText = device.lastRunMode || "Unknown";
    parametersUsed.innerText = Object.entries(device.lastRunParameters || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ") || "N/A";

    if (!debugData || Object.keys(debugData).length === 0) {
        tableContainer.style.display = "none";
        console.warn("⚠️ No debug data available.");
        table.innerHTML = "<tr><th>No Data</th></tr>";
        return;
    }

    tableContainer.style.display = "block";

    // Function to round to 3 significant figures
    function roundToSignificantFigures(num, n) {
        if (num === 0) return 0;
        const d = Math.ceil(Math.log10(num < 0 ? -num : num)); // Get the number of digits in the number
        const power = n - d;
        const magnitude = Math.pow(10, power);
        return Math.round(num * magnitude) / magnitude;
    }

    // Collect all timestamps from the MOTOR, SENSOR, CONTROL, and SQUARE data and categorize data by debug type
    const allTimestamps = [
        ...debugData.MOTOR_LEFT.map(entry => roundToSignificantFigures(entry.timestamp, 3)), // Round to 3 significant figures
        ...debugData.MOTOR_RIGHT.map(entry => roundToSignificantFigures(entry.timestamp, 3)),
        ...debugData.SENSOR.map(entry => roundToSignificantFigures(entry.timestamp, 3)),
        ...debugData.CONTROL.map(entry => roundToSignificantFigures(entry.timestamp, 3)),
        ...debugData.SQUARE.map(entry => roundToSignificantFigures(entry.timestamp, 3))
    ];

    // Remove duplicates by converting the array to a Set, then back to an array
    const uniqueTimestamps = [...new Set(allTimestamps)];

    // Sort timestamps
    const sortedTimestamps = uniqueTimestamps.sort((a, b) => a - b);;

    // Extract all available debug types (MOTOR, SENSOR, CONTROL, SQUARE)
    const debugTypes = ["MOTOR_LEFT","MOTOR_RIGHT", "SENSOR", "CONTROL", "SQUARE"];

    // Generate table headers dynamically
    const headers = ["Timestamp", ...debugTypes];
    const tableHead = table.querySelector("thead");
    tableHead.innerHTML = "<tr>" + headers.map(header => `<th>${header}</th>`).join("") + "</tr>";

    // Populate table rows
    const tableBody = table.querySelector("tbody");
    tableBody.innerHTML = sortedTimestamps.map(timestamp => {
        const rowData = [`<td>${timestamp}</td>`];

        // For each debug type (MOTOR, SENSOR, CONTROL, SQUARE), create a column for the data
        debugTypes.forEach(type => {
            let entry = "";
            if (debugData[type]) {
                entry = debugData[type].find(entry => roundToSignificantFigures(entry.timestamp,3) === timestamp);
            }

            if (entry) {
                if (type === "MOTOR_LEFT") {
                    rowData.push(`<td>Distance=${entry.distance}, Speed=${entry.speed}, Set=${entry.set_speed}, Error=${entry.error}, Adjustment=${entry.adjustment}</td>`);
                } else if (type === "MOTOR_RIGHT") {
                    rowData.push(`<td>Distance=${entry.distance}, Speed=${entry.speed}, Set=${entry.set_speed}, Error=${entry.error}, Adjustment=${entry.adjustment}</td>`);
                } else if (type === "SENSOR") {
                    rowData.push(`<td>Error=${entry.error}, Sensors=[${entry.sensor_values.join(", ")}]</td>`);
                } else if (type === "CONTROL") {
                    rowData.push(`<td>PID=${entry.pid_output}, Multiplier=${entry.multiplier}</td>`);
                } else if (type === "SQUARE") {
                    rowData.push(`<td>Left Dist=${entry.left_distance}, Right Dist=${entry.right_distance}, Error=${entry.error}, PID=${entry.pid_output}, Multiplier=${entry.multiplier}</td>`);
                }
            } else {
                rowData.push(`<td>No Data</td>`); // If no data for the type at this timestamp
            }
        });

        return `<tr>${rowData.join("")}</tr>`;
    }).join("");

    document.dispatchEvent(new Event("fetchState"));
}




export function downloadDebugCSV(debugData) {
    if (!debugData || (debugData.MOTOR_LEFT.length === 0 && debugData.MOTOR_RIGHT.length === 0 && debugData.SENSOR.length === 0 && debugData.CONTROL.length === 0 && debugData.SQUARE.length === 0)) {
        console.warn("⚠️ No debug data available to download.");
        alert("No debug data to download.");
        return;
    }

    const modeUsed = device.lastRunMode || "Unknown";
    const parametersUsed = JSON.stringify(device.lastRunParameters || {});

    // Function to round to 3 significant figures
    function roundToSignificantFigures(num, n) {
        if (num === 0) return 0;
        const d = Math.ceil(Math.log10(num < 0 ? -num : num)); // Get the number of digits in the number
        const power = n - d;
        const magnitude = Math.pow(10, power);
        return Math.round(num * magnitude) / magnitude;
    }

    // Extract all timestamps for all debug types and round them to 3 significant figures
    const getRoundedTimestamps = (data) => {
        return data.map(entry => roundToSignificantFigures(entry.timestamp, 3));
    };

    // Collect all timestamps and debug entries by type
    const debugTypes = ["MOTOR_LEFT", "MOTOR_RIGHT", "SENSOR", "CONTROL", "SQUARE"];
    const allData = {};

    debugTypes.forEach(type => {
        const data = debugData[type] || [];
        const roundedTimestamps = getRoundedTimestamps(data);
        allData[type] = { data, roundedTimestamps };
    });

    // Prepare CSV content
    let csvContent = `Mode Used: ${modeUsed}\nParameters Used: ${parametersUsed}\n\n`;

    // Generate CSV tables for each debug type
    debugTypes.forEach(type => {
        const data = allData[type].data;
        const roundedTimestamps = allData[type].roundedTimestamps;

        if (data.length > 0) {
            csvContent += `\n--- ${type} Debug Data ---\n`;
            csvContent += "Timestamp, " + Object.keys(data[0]).filter(key => key !== "timestamp").join(", ") + "\n"; // Headers excluding timestamp

            // Iterate through data and generate rows
            data.forEach(entry => {
                const row = roundedTimestamps.map((timestamp, index) => {
                    if (roundToSignificantFigures(entry.timestamp,3) === roundedTimestamps[index]) {
                        return `"${timestamp}",${Object.values(entry).filter((_, i) => i !== 0).join(",")}`;
                    }
                    return null;
                }).find(value => value); // Get the row corresponding to the rounded timestamp

                csvContent += row + "\n";
            });
        }
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


// Function to trigger path computation
export function generateTrack(debugData) {
    if (!debugData.MOTOR_LEFT?.length || !debugData.MOTOR_RIGHT?.length) {
        alert("🚨 Missing required data (MOTOR_LEFT or MOTOR_RIGHT distances)");
        return;
    }

    // Store data in localStorage for use in the new page
    localStorage.setItem("buggyData", JSON.stringify(debugData));

    // Open the new page
    window.open("buggyPath.html", "_blank");
}
