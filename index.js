require("dotenv").config();
const express = require("express");
const { Telegraf } = require("telegraf");

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

app.use(express.json());

// In-memory database (for testing purposes, better to use a real database)
const users = {}; // { "ESP_CODE_123": telegram_id }
const waitingForEspCode = {}; // { userId: true }

// Start the bot
bot.start((ctx) => {
    ctx.reply("Welcome! Send your ESP32 code to register it.");
});

// Command for showing help
bot.command("help", (ctx) => {
    const helpMessage = `
    🤖 **Available Commands:**

    /help - Show this help message
    /register - Register your ESP32 device
    /status - Get the current irrigation status for your ESP32
    `;
    ctx.reply(helpMessage);
});

// Command for registering ESP32
bot.command("register", (ctx) => {
    const userId = ctx.from.id;

    // Mark the user as waiting for the ESP32 code
    waitingForEspCode[userId] = true;

    ctx.reply("Please send your ESP32 code (e.g., ESP_ABC123) to register it.");
});

// Command for checking irrigation status
bot.command("status", (ctx) => {
    const userId = ctx.from.id;
    const espCode = Object.keys(users).find((code) => users[code] === userId);

    if (!espCode) {
        return ctx.reply(
            "You have no registered ESP32. Please register it first using /register.",
        );
    }

    // For now, just return a dummy message about irrigation status
    const message = `Irrigation status for ESP32 (${espCode}): Active ✅`;

    // Send the status message to the user
    ctx.reply(message);
});

// Listen for any message that could be the ESP32 code
bot.on("message", (ctx) => {
    const userId = ctx.from.id;
    const message = ctx.message.text.trim();

    // Check if the user is in the process of registering
    if (waitingForEspCode[userId]) {
        if (message.startsWith("ESP_")) {
            // Register the ESP32 code for the user
            users[message] = userId;
            delete waitingForEspCode[userId]; // Reset the state
            ctx.reply(`Your ESP32 (${message}) has been registered.`);
        } else {
            ctx.reply(
                "Invalid code. Please send a valid ESP32 code (e.g., ESP_ABC123).",
            );
        }
    }
});

// Endpoint to receive data from the ESP32
app.post("/notify", (req, res) => {
    const {
        esp_code,
        airTemp,
        airHumidity,
        soilMoisture,
        lightIntensity,
        minAirTemp,
        maxAirTemp,
        minAirHumidity,
        maxAirHumidity,
        minSoilMoisture,
        minLightIntensity,
        maxLightIntensity,
        isIrrigating, // Changed to use a boolean
    } = req.body;

    // Check if the ESP32 is registered
    if (!users[esp_code]) {
        return res.status(400).json({ error: "ESP32 not registered" });
    }

    // Create the message to send
    const message = `
    🌱 Irrigation Status for ESP32 (${esp_code})

    Current Values:
    - 🌡️ Air Temperature: ${airTemp}°C
    - 💧 Air Humidity: ${airHumidity}%
    - 🌿 Soil Moisture: ${soilMoisture}%
    - 💡 Light Intensity: ${lightIntensity} lux

    Optimal Ranges:
    - 🌡️ Air Temperature: ${minAirTemp}°C - ${maxAirTemp}°C
    - 💧 Air Humidity: ${minAirHumidity}% - ${maxAirHumidity}%
    - 🌿 Soil Moisture: ${minSoilMoisture}%
    - 💡 Light Intensity: ${minLightIntensity} lux - ${maxLightIntensity} lux

    Irrigation Status:
    - 💧 Irrigation: ${isIrrigating ? "Active ✅" : "Inactive ❌"}
    `;

    // Get the Telegram ID associated with the ESP32
    const telegramId = users[esp_code];

    // Send the message to Telegram
    bot.telegram.sendMessage(telegramId, message);

    // Respond to the client
    res.json({ success: true });
});

bot.launch();

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).send("Server is up and running!");
});

// Start the server
app.listen(3000, () => console.log("Server started on port 3000"));
