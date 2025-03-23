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
    ctx.reply("Welcome! Please choose an option:", {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "Register ESP32", callback_data: "register" },
                    {
                        text: "Check Irrigation Status",
                        callback_data: "status",
                    },
                ],
                [{ text: "Help", callback_data: "help" }],
            ],
        },
    });
});

// Handle callback queries (button clicks)
bot.on("callback_query", async (ctx) => {
    const action = ctx.callbackQuery.data;

    // Conferma la ricezione della callback per evitare che il messaggio venga duplicato
    await ctx.answerCbQuery();

    if (action === "register") {
        waitingForEspCode[ctx.from.id] = true;
        ctx.reply(
            "Please send your ESP32 code (e.g., ESP_ABC123) to register it.",
        );
    } else if (action === "status") {
        const espCode = Object.keys(users).find(
            (code) => users[code] === ctx.from.id,
        );
        if (!espCode) {
            return ctx.reply(
                "You have no registered ESP32. Please register it first using /register.",
            );
        }
        const message = `Irrigation status for ESP32 (${espCode}): Active ✅`;
        ctx.reply(message);
    } else if (action === "help") {
        const helpMessage = `
        🤖 **Available Commands:**

        /help - Show this help message
        /register - Register your ESP32 device
        /status - Get the current irrigation status for your ESP32
        `;
        // Rispondi con il messaggio completo di help
        ctx.reply(helpMessage);
    }
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
        minAirTemp,
        maxAirTemp,
        minAirHumidity,
        maxAirHumidity,
        minSoilMoisture,
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

    Optimal Ranges:
    - 🌡️ Air Temperature: ${minAirTemp}°C - ${maxAirTemp}°C
    - 💧 Air Humidity: ${minAirHumidity}% - ${maxAirHumidity}%
    - 🌿 Soil Moisture: ${minSoilMoisture}%

    Irrigation Status:
    - 💧 Irrigation: ${isIrrigating ? "Active ✅" : "Inactive ❌"}
    `;

    // Get the Telegram ID associated with the ESP32
    const telegramId = users[esp_code];

    // Send the message to Telegram
    bot.telegram
        .sendMessage(telegramId, message)
        .then(() => {
            res.json({ success: true });
        })
        .catch((error) => {
            console.error("Error sending message:", error);
            res.status(500).json({ error: "Failed to send message" });
        });
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).send("Server is up and running!");
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
    console.log("Server started on port", process.env.PORT || 3000);
});

// Launch the bot
bot.launch()
    .then(() => console.log("Telegram bot started"))
    .catch((err) => console.error("Failed to start the bot:", err));
