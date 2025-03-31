import { device } from "./Device.js";
import { fetchState } from "./BuggyState.js";

export function updateDebugTable(accumulatedDebugData) {
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
    document.getElementById("lastRunData").style.display="block"
    modeUsed.innerText = device.lastRunMode || "Unknown";

    // Format parameters as key-value pairs without quotes
    const params = device.lastRunParameters || {};
    const formattedParams = Object.entries(params)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
    
    parametersUsed.innerText = formattedParams || "N/A";

    if (!accumulatedDebugData || accumulatedDebugData.length === 0) {
        document.getElementById("debugData").style.display="none";
        console.warn("⚠️ No debug data available.");
        table.innerHTML = "<tr><th>No Data</th></tr>";
        return;
    }

    document.getElementById("debugData").style.display="block";
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


export function downloadDebugCSV(accumulatedDebugData) {
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

// Function to trigger path computation
export function generateTrack(accumulatedDebugData) {
    if (!accumulatedDebugData.some(data => data.Left_Distance && data.Right_Distance && data.time)) {
        alert("🚨 Missing required data (Left_Distance, Right_Distance, Time)");
        return;
    }
    // Store data in localStorage for use in the new page
    localStorage.setItem("buggyData", JSON.stringify(accumulatedDebugData));

    // Open the new page
    window.open("buggyPath.html", "_blank");
}

