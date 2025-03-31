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

function updateParameters(parameters){
    // Get the parameters div
    const paramDiv = document.getElementById("parameter_list");
    if (!paramDiv) {
        console.error("❌ ERROR: Parameters div not found!");
        return;
    }

    // Clear the parameter list
    paramDiv.innerHTML = "";

    // Ensure parameters exist before updating UI
    if (!parameters || Object.keys(parameters).length === 0) {
        console.warn("⚠️ No parameters to display.");
        return;
    }

    console.log("Parameters received:", parameters);


    // Add input fields for each parameter
    Object.entries(parameters).forEach(([key, value]) => {
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
    }
}