import { device } from "./Device.js";

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


// Function to update buttons based on buggy state
function updateButtons() {
    const control_buttonsDIV = document.getElementById("control_buttons");
    // Check if buggy is IDLE
    if (device.buggyState.mode === "IDLE") {
        // Set new buttons for IDLE mode
        control_buttonsDIV.innerHTML = `
            <button id="Calibrate-White-button">CALIBRATE WHITE</button>
            <button id="Turn-Around-button">TURN AROUND</button>
            <button id="Stop-button">STOP</button>
        `;

        // Add event listeners for IDLE mode buttons
        document.querySelector("#Calibrate-White-button").addEventListener("click", calibrateWhite);
        document.querySelector("#Turn-Around-button").addEventListener("click", turnAroundCommand);
        document.querySelector("#Stop-button").addEventListener("click", stopCommand);
    } else {
        // Set original buttons for normal mode
        control_buttonsDIV.innerHTML = `
            <button id="Start-button">GO</button>
            <button id="Turn-Around-button">TURN AROUND</button>
            <button id="Stop-button">STOP</button>
        `;

        // Add event listeners for normal mode buttons
        document.querySelector("#Start-button").addEventListener("click", startBuggy);
        document.querySelector("#Turn-Around-button").addEventListener("click", turnAroundCommand);
        document.querySelector("#Stop-button").addEventListener("click", stopCommand);
    }
}

function updateParameters(){
    // Get the parameters div
    const paramDiv = document.getElementById("parameter_list");
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
function updateUI() {
    console.log("Updating UI with state:", device.buggyState);

    // Update mode
    document.getElementById("mode").innerText = device.buggyState.mode;
    //update mode specific Controls
    updateButtons();

    if (device.buggyState.mode!="IDLE"){
        document.getElementById("parameters").style.display = "block";
        updateParameters();
    }
}