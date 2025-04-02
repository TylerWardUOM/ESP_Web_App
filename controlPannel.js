import { callibrateBlackCommand, callibrateWhiteCommand, startBuggy, stopCommand, turnAroundCommand } from "./BuggyCommands.js";

// Function to update buttons based on buggy state
function updateButtons(_mode) {
    const control_buttonsDIV = document.getElementById("control_buttons");
    // Check if buggy is IDLE
    if (_mode === "IDLE") {
        // Set new buttons for IDLE mode
        control_buttonsDIV.innerHTML = `
            <button id="Calibrate-White-button">CALIBRATE WHITE</button>
            <button id="Calibrate-Black-button">CALIBRATE BLACK</button>
            <button id="Turn-Around-button">TURN AROUND</button>
            <button id="Stop-button">STOP</button>
        `;

        // Add event listeners for IDLE mode buttons
        document.querySelector("#Calibrate-White-button").addEventListener("click", callibrateWhiteCommand);
        document.querySelector("#Calibrate-Black-button").addEventListener("click", callibrateBlackCommand);
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
        document.querySelector("#Start-button").addEventListener("click", () => {
            startBuggy();
            document.getElementById("mode").innerText = "waiting_for_movement";
        });        
        document.querySelector("#Turn-Around-button").addEventListener("click", turnAroundCommand);
        document.querySelector("#Stop-button").addEventListener("click", stopCommand);
    }
}

function updateParameters(parameters) {
    const paramDiv = document.getElementById("parameter_list");
    if (!paramDiv) {
        console.error("❌ ERROR: Parameters div not found!");
        return;
    }

    paramDiv.innerHTML = ""; // Clear previous entries

    if (!parameters || Object.keys(parameters).length === 0) {
        console.warn("⚠️ No parameters to display.");
        return;
    }

    console.log("Parameters received:", parameters);

    Object.entries(parameters).forEach(([key, value]) => {
        console.log(`Adding parameter: ${key} = ${value}`);

        const paramRow = document.createElement("div");
        paramRow.classList.add("parameter-item");

        const label = document.createElement("label");
        label.innerText = `${key}: `;

        let input;

        if (key.toLowerCase().includes("flag")) {
            input = document.createElement("input");
            input.type = "checkbox";
            input.id = `param-${key}`;
            input.checked = parseFloat(value) === 1.0; // Convert stored value to boolean

            input.addEventListener("change", () => {
                parameters[key] = input.checked ? 1.0 : 0.0; // ✅ Fix: Correctly update unchecked value to 0.0
                console.log(`Updated ${key}: ${parameters[key]}`);
            });

        } else {
            input = document.createElement("input");
            input.type = "text";
            input.id = `param-${key}`;
            input.value = value;
            input.dataset.initial = value;
            input.style.color = "gray";

            input.addEventListener("input", () => {
                input.style.color = (input.value.trim() === input.dataset.initial) ? "gray" : "black";
            });
        }

        paramRow.appendChild(label);
        paramRow.appendChild(input);
        paramDiv.appendChild(paramRow);
    });
}

export function updateUI(_mode,parameters) {
    console.log("Updating UI with state:", {_mode,parameters});

    // Update mode
    document.getElementById("mode").innerText = _mode;
    //update mode specific Controls
    updateButtons(_mode);

    if (_mode!="IDLE"){
        document.getElementById("parameters").style.display = "block";
        updateParameters(parameters);
    }else{
        document.getElementById("parameters").style.display = "none";
        document.dispatchEvent(new Event("fetchBattery"));
    }
}

export function updateBatteryDisplay(batteryState) {
    console.log("🔋 Battery Info Updated:", batteryState);

    // Update UI elements (assuming you have elements with these IDs)
    document.getElementById("batteryVoltage").innerText = `Voltage: ${batteryState.voltage.toFixed(2)}V`;
    document.getElementById("batteryCurrent").innerText = `Current: ${batteryState.current.toFixed(3)}A`;
    document.getElementById("batteryPercentage").innerText = `Charge: ${batteryState.batteryPercentage.toFixed(2)}%`;

    // Optional: Change UI color if battery is low
    if (batteryState.batteryPercentage < 20) {
        document.getElementById("batteryPercentage").style.color = "red";
    } else {
        document.getElementById("batteryPercentage").style.color = "green";
    }
}
