import { callibrateBlackCommand, callibrateWhiteCommand, startBuggy, stopCommand, turnAroundCommand,updateSpeedCommand } from "./BuggyCommands.js";

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
    } else if (_mode === "RC") {
        // Create RC Mode Arrow Key Layout
        control_buttonsDIV.innerHTML = `
            <div class="rc-controls">
                <div class="rc-row">
                    <button id="up-button" class="arrow">▲</button>
                </div>
                <div class="rc-row">
                    <button id="left-button" class="arrow">◀</button>
                    <button id="down-button" class="arrow">▼</button>
                    <button id="right-button" class="arrow">▶</button>
                </div>
            </div>
        `;

        // Get button elements
        const upButton = document.getElementById("up-button");
        const downButton = document.getElementById("down-button");
        const leftButton = document.getElementById("left-button");
        const rightButton = document.getElementById("right-button");

        // Function to update button styles based on pressed state
        function updateButtonStates() {
            upButton.classList.toggle("active", activeKeys.has("w") || activeKeys.has("ArrowUp"));
            downButton.classList.toggle("active", activeKeys.has("s") || activeKeys.has("ArrowDown"));
            leftButton.classList.toggle("active", activeKeys.has("a") || activeKeys.has("ArrowLeft"));
            rightButton.classList.toggle("active", activeKeys.has("d") || activeKeys.has("ArrowRight"));
        }

        // Update button states whenever keys change
        document.addEventListener("keydown", (event) => {
            activeKeys.add(event.key);
            updateButtonStates();
        });

        document.addEventListener("keyup", (event) => {
            activeKeys.delete(event.key);
            updateButtonStates();
        });
    }else {
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
            document.getElementById("parameters").style.display = "none";
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

// RC Mode Variables
let leftMotorSpeed = 0;
let rightMotorSpeed = 0;
let prevLeftMotorSpeed = null;
let prevRightMotorSpeed = null;
let rcControlsInitialized = false;
let activeKeys = new Set(); // Track pressed keys

let keyDownHandler;
let keyUpHandler;

// Function to calculate motor speeds based on active keys
async function updateMotorSpeeds() {
    let newLeftSpeed = 0;
    let newRightSpeed = 0;

    if (activeKeys.has("w") || activeKeys.has("ArrowUp")) {
        newLeftSpeed += 300;
        newRightSpeed += 300;
    }
    if (activeKeys.has("s") || activeKeys.has("ArrowDown")) {
        newLeftSpeed -= 300;
        newRightSpeed -= 300;
    }
    if (activeKeys.has("a") || activeKeys.has("ArrowLeft")) {
        newLeftSpeed -= 150; // Slow down left wheel
        newRightSpeed += 150; // Right wheel moves faster
    }
    if (activeKeys.has("d") || activeKeys.has("ArrowRight")) {
        newLeftSpeed += 150; // Left wheel moves faster
        newRightSpeed -= 150; // Slow down right wheel
    }

    // Clamp values between -300 and 300 to prevent exceeding limits
    newLeftSpeed = Math.max(-300, Math.min(300, newLeftSpeed));
    newRightSpeed = Math.max(-300, Math.min(300, newRightSpeed));

    // Only send update if values have changed
    if (newLeftSpeed !== prevLeftMotorSpeed || newRightSpeed !== prevRightMotorSpeed) {
        leftMotorSpeed = newLeftSpeed;
        rightMotorSpeed = newRightSpeed;
        prevLeftMotorSpeed = newLeftSpeed;
        prevRightMotorSpeed = newRightSpeed;

        console.log(`Left Motor: ${leftMotorSpeed}, Right Motor: ${rightMotorSpeed}`);
        await updateSpeedCommand("left", leftMotorSpeed);
        await updateSpeedCommand("right", rightMotorSpeed);
    }
}

// Function to handle RC Mode
function handleRCMode(enable) {
    if (enable) {
        if (!rcControlsInitialized) {
            rcControlsInitialized = true;

            keyDownHandler = async (event) => {
                await updateMotorSpeeds();
            };

            keyUpHandler = async (event) => {
                await updateMotorSpeeds();
            };

            document.addEventListener("keydown", keyDownHandler);
            document.addEventListener("keyup", keyUpHandler);
        }
    } else {
        if (rcControlsInitialized) {
            document.removeEventListener("keydown", keyDownHandler);
            document.removeEventListener("keyup", keyUpHandler);
            rcControlsInitialized = false;
            activeKeys.clear();
        }
    }
}

// Main UI Update Function
export function updateUI(_mode, parameters) {
    console.log("Updating UI with state:", { _mode, parameters });

    document.getElementById("mode").innerText = _mode;
    updateButtons(_mode);

    if (_mode === "RC") {
        document.getElementById("parameters").style.display = "none";
        handleRCMode(true);
    } else {
        handleRCMode(false);
        if (_mode !== "IDLE") {
            document.getElementById("parameters").style.display = "block";
            updateParameters(parameters);
        } else {
            document.getElementById("parameters").style.display = "none";
            document.dispatchEvent(new Event("fetchBattery"));
        }
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
