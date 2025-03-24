import { useState } from 'react'
import './App.css'

function App() {
  const [connectionStatus, setConnectionStatus] = useState("Not Connected");
  const [mode, setMode] = useState("Not Connected");
  const [debugModeUsed, setDebugModeUsed] = useState("Unknown");
  const [debugParamsUsed, setDebugParamsUsed] = useState("N/A");
  const [showSensorData, setShowSensorData] = useState(false);

  return (
    <div style={{ textAlign: "center", fontFamily: "Arial, sans-serif", margin: "20px" }}>
            <h1>Buggy Control Panel</h1>

            <button onClick={handleConnect}>Connect to Buggy</button>
            <p style={{ color: connectionStatus.includes("✅") ? "green" : "#d9534f" }}>
                {connectionStatus}
            </p>
            <ConnectionModal device={device} onConnect={()=>{}} onDisconnect={()=>{}} />
            <div>a
                <h2>Current Mode: <span>{mode}</span></h2>
                <label htmlFor="modeSelect">Change Mode:</label>
                <select id="modeSelect" onChange={handleModeChange}>
                    <option value="IDLE">Idle Mode</option>
                    <option value="SPEED_CONTROL">Speed Control Mode</option>
                    <option value="SQUARE_IDLE">Square Idle Mode</option>
                    <option value="STRAIGHT_LINE">Line Menu Mode</option>
                    <option value="TURN_ANGLE">Turn Menu Mode</option>
                    <option value="FOLLOW_LINE">Follow PID Menu Mode</option>
                    <option value="BANG_BANG">Bang Bang Menu Mode</option>
                    <option value="BANG_BANG_PROPORTIONAL">Bang Bang Proportional Menu Mode</option>
                    <option value="SENSOR_DEBUG">Sensor Debug Mode</option>
                </select>
                <button>Set Mode</button>

                <h3>Update Parameters</h3>
                <button>Update Parameters</button>

                <h3>Control Buggy</h3>
                <button>GO</button>
            </div>

            <div>
                <h3>Debug Data</h3>
                <button>Download Debug Data</button>
                <div>
                    <p><strong>Mode Used:</strong> {debugModeUsed}</p>
                    <p><strong>Parameters Used:</strong> {debugParamsUsed}</p>
                </div>
            </div>

            <table>
                <thead></thead>
                <tbody></tbody>
            </table>

            <button onClick={() => setShowSensorData(!showSensorData)}>
                {showSensorData ? "Hide Sensor Data" : "Show Sensor Data"}
            </button>

            {showSensorData && (
                <div>
                    <h3>Sensor Data</h3>
                    <table border="1" style={{ margin: "0 auto" }}>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>S1</th><th>S2</th><th>S3</th><th>S4</th><th>S5</th><th>S6</th>
                                <th>Error</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>

                    <h3>Sensor Bar Graph</h3>
                    <div></div>

                    <h3>Estimated Line Position</h3>
                    <canvas></canvas>

                    <h3>Adjust Sensor Weights</h3>
                    <div>
                        {[...Array(6)].map((_, i) => (
                            <label key={i}>
                                S{i + 1}: <input type="number" defaultValue="1" step="0.1" />
                            </label>
                        ))}
                        <button>Update Weights</button>
                    </div>
                </div>
            )}
        </div>
  )
}

export default App
