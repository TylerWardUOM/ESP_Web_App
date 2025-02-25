// Fetch state & parameters on load
window.onload = async function () {
    await fetchState();
};

// Fetch buggy mode and parameters
async function fetchState() {
    try {
        const response = await fetch("http://localhost:3001/state");
        const data = await response.json();
        
        document.getElementById("mode").innerText = data.mode;

        // Display parameters with input fields
        const paramDiv = document.getElementById("parameters");
        paramDiv.innerHTML = ""; // Clear existing data

        Object.entries(data.parameters).forEach(([key, value]) => {
            const paramRow = document.createElement("div");

            paramRow.innerHTML = `
                <label>${key}: </label>
                <input type="text" id="param-${key}" placeholder="${value}">
            `;
            paramDiv.appendChild(paramRow);
        });
    } catch (error) {
        console.error("Error fetching state:", error);
    }
}

// Update parameters only if changed
async function updateParameters() {
    const paramInputs = document.querySelectorAll("#parameters input");
    let updates = {};

    paramInputs.forEach(input => {
        const key = input.id.replace("param-", ""); // Remove "param-" prefix
        const newValue = input.value.trim();
        
        if (newValue !== "") { // Only update if something was entered
            updates[key] = parseFloat(newValue) || newValue; // Convert to number if possible
        }
    });

    if (Object.keys(updates).length === 0) {
        alert("No changes made.");
        return;
    }

    try {
        await fetch("http://localhost:3001/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
        });

        alert("Updated parameters!");
        fetchState(); // Refresh the display
    } catch (error) {
        console.error("Error updating parameters:", error);
    }
}

// Send GO command
async function startBuggy() {
    try {
        await fetch("http://localhost:3001/start", { method: "POST" });
        alert("Buggy started!");
    } catch (error) {
        console.error("Error starting buggy:", error);
    }
}

async function fetchPorts() {
    try {
        const response = await fetch("http://localhost:3001/ports");
        const ports = await response.json();
        
        const select = document.getElementById("port-select");
        select.innerHTML = ""; // Clear previous options
        
        ports.forEach(port => {
            const option = document.createElement("option");
            option.value = port;
            option.textContent = port;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching ports:", error);
    }
}

// Call this when the page loads
fetchPorts();

async function connectToPort() {
    const selectedPort = document.getElementById("port-select").value;

    if (!selectedPort) {
        alert("Please select a port");
        return;
    }

    try {
        const response = await fetch("http://localhost:3001/set-port", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ portName: selectedPort })
        });

        const result = await response.json();
        alert(result.message);
    } catch (error) {
        console.error("Error setting port:", error);
    }
}
