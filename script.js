// Fetch state & parameters on load
window.onload = async function () {
    await fetchPorts(); // Ensure ports are populated on load
    await fetchConnectionState(); // Fetch the connection state
};

// Fetch the connection state
async function fetchConnectionState() {
    try {
        const response = await fetch("http://localhost:3001/connection-state");
        const data = await response.json();
        
        // Update the connection state on the UI
        if (data.isConnected) {
            isConnected = true;
            document.getElementById("connect-btn").innerText = "Disconnect"; // Change button text to Disconnect
        } else {
            isConnected = false;
            document.getElementById("connect-btn").innerText = "Connect"; // Change button text to Connect
        }

        // Optionally, update the port display
        if (data.currentPort) {
            document.getElementById("port-select").value = data.currentPort;
        }

        // Also fetch the buggy state and parameters after checking connection
        fetchState();
    } catch (error) {
        console.error("Error fetching connection state:", error);
    }
}

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

// Function to start the movement when the GO button is pressed
async function startBuggy() {
    try {
        // Disable all UI controls while movement is starting
        disableUI();

        // Update mode to "waiting_for_movement" and clear the parameters
        document.getElementById("mode").innerText = "waiting_for_movement";
        document.getElementById("parameters").innerHTML = ""; // Clear parameters list

        const response = await fetch("http://localhost:3001/start", { method: "POST" });
        const data = await response.json();

        if (data.message === "STARTING MOVEMENT") {
            // Optionally alert the user or update the status
            //document.getElementById("status").innerText = "Waiting for movement to finish..."; // Update UI
        }

        // Poll the server to check if the movement is finished
        const movementFinished = await checkIfMovementFinished();

        if (movementFinished) {
            // Fetch the new state after movement is finished
            await fetchState();  // Fetch the state again after movement finishes

            // Re-enable UI controls after movement finishes
            enableUI();

            window.open('debug.html', '_blank');
        } else {
            // Handle unexpected results or timeouts
            //document.getElementById("status").innerText = "Error: Movement did not finish as expected.";
            enableUI();
        }
    } catch (error) {
        console.error("Error starting buggy:", error);
        //document.getElementById("status").innerText = "Error: Could not start movement.";
        enableUI(); // Re-enable UI controls in case of error
    }
}

// Disable UI controls during movement
function disableUI() {
    // Disable all inputs and buttons related to controlling the buggy
    const controls = document.querySelectorAll('input, button');
    controls.forEach(control => {
        control.disabled = true;
    });
}

// Enable UI controls after movement finishes
function enableUI() {
    // Enable all inputs and buttons
    const controls = document.querySelectorAll('input, button');
    controls.forEach(control => {
        control.disabled = false;
    });
}


// Poll the server to check if the movement is finished
async function checkIfMovementFinished() {
    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            try {
                const response = await fetch("http://localhost:3001/is-movement-finished");
                const data = await response.json();
                if (data.finished) {
                    clearInterval(interval);
                    //document.getElementById("status").innerText = "Movement finished!";
                    resolve(true); // Movement is finished
                }
            } catch (error) {
                clearInterval(interval);
                reject("Error checking movement status.");
            }
        }, 300); // Check every second

        // Set a timeout to prevent infinite polling
        setTimeout(() => {
            clearInterval(interval);
            reject("Timeout waiting for movement to finish.");
        }, 30000); // Timeout after 30 seconds
    });
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

let isConnected = false; // Track connection state

async function connectToPort() {
    const selectedPort = document.getElementById("port-select").value;

    if (!selectedPort) {
        alert("Please select a port");
        return;
    }

    try {
        if (isConnected) {
            // If already connected, disconnect
            const response = await fetch("http://localhost:3001/disconnect", {
                method: "POST",
            });
            const result = await response.json();
            alert(result.message);

            document.getElementById("connect-btn").innerText = "Connect"; // Change button back to Connect
            isConnected = false; // Update the state
            fetchState();
        } else {
            // If not connected, attempt to connect
            const response = await fetch("http://localhost:3001/set-port", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ portName: selectedPort })
            });

            const result = await response.json();
            alert(result.message);

            // After successful connection, fetch state
            fetchState(); // Fetch state and parameters right after connecting to the port

            // Change button text to Disconnect
            document.getElementById("connect-btn").innerText = "Disconnect";
            isConnected = true; // Update the connection state
        }
    } catch (error) {
        console.error("Error setting port:", error);
    }
}

// Function to handle the mode change when the button is clicked
function changeMode() {
    // Check if the system is connected before allowing mode change
    if (!isConnected) {
        alert("Please connect to a port first.");
        return;
    }

    // Get the selected mode from the dropdown
    const selectedMode = document.getElementById("modeSelect").value;

    // Here, we are sending the selected mode to the backend (or Bluetooth device)
    sendModeChangeRequest(selectedMode);
}

// Function to send the mode change request to the server/backend
async function sendModeChangeRequest(mode) {
    try {
        const response = await fetch("http://localhost:3001/setMode", {
            method: "POST", // Use POST instead of GET
            headers: {
                "Content-Type": "application/json" // Make sure the Content-Type is JSON
            },
            body: JSON.stringify({ mode: mode }) // Send the mode as JSON
        });
        
        const data = await response.json();
        console.log("Mode change request response:", data);

        // After sending the mode change request, fetch the new state to confirm if the mode was updated
        const oldmode = document.getElementById("mode").innerText; // Get the mode from the display

        await fetchState();

        const currentMode = document.getElementById("mode").innerText;

        // Check if the mode has been updated successfully
        if (currentMode != oldmode) {
            //alert(`Successfully changed mode to ${mode}`);
        } else {
            alert("Error changing mode. Mode was not updated.");
        }
    } catch (error) {
        console.error("Error changing mode:", error);
        alert("Error changing mode.");
    }
}