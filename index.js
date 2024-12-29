const TelegramBot = require('node-telegram-bot-api');
const stringSimilarity = require('string-similarity');
const fuzz = require('fuzzball');
const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const jsonDataBefore = require('./data.json');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
// Inisialisasi koneksi ke database MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

var startData = [
    [
        {
            text: 'Skripsi',
            callback_data: 'skripsi',
        },
        {
            text: 'KP / Magang',
            callback_data: 'pkl',
        }
    ]
];

var menuData = [
    [
        {
            text: 'Menu Utama',
            callback_data: 'menu_utama',
        },
        {
            text: 'Selesai',
            callback_data: 'selesai',
        }
    ]
];

async function buttonFunc(msg, title, menus) {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: {
            inline_keyboard: menus
        }
    };

    bot.sendMessage(chatId, title, options);
}

async function checkId(chatId, selectedOption) {
    let foundData = false;
    jsonDataBefore.forEach(async (item) => {
        foundData = item.chatId == chatId ? true : false
        foundData == true ? item.message = selectedOption : ""
    });

    if (foundData == false) {
        jsonDataBefore.push({
            chatId: chatId,
            message: selectedOption
        });
    }

    fs.writeFileSync('./data.json', JSON.stringify(jsonDataBefore, null, 2));

}

// Callback message ketika user memilih button
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const selectedOption = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;
    let responseText = '';
    if (selectedOption === 'skripsi' || selectedOption === 'pkl') {
        if (selectedOption === 'skripsi') {
            responseText = 'Anda memilih opsi : Skripsi';
        } else if (selectedOption === 'pkl') {
            responseText = 'Anda memilih opsi : Pkl';
        }
        await checkId(chatId, selectedOption)
        await bot.sendMessage(chatId, responseText)
        await bot.sendMessage(chatId, `Untuk melanjutkan permintaan anda, silahkan masukkan judul atau bagan yang ingin diketahui : 
        (Contoh: pengertian ${selectedOption})`);
        await bot.answerCallbackQuery(callbackQuery.id);
    } else {
        if (selectedOption === 'menu_utama') {
            await buttonFunc(callbackQuery.message, "silahkan pilih opsi berikut :", startData)
            await bot.answerCallbackQuery(callbackQuery.id);
        } else if (selectedOption === 'selesai') {
            await bot.sendMessage(chatId, "Senang bisa membantu anda🙏😁")
            await bot.answerCallbackQuery(callbackQuery.id);
        } else {
            let foundData = "";
            function filterByID(item) {
                if (item.chatId == chatId) {
                    return true;
                }
                return false;
            }

            foundData = jsonDataBefore.filter(filterByID)
            if (foundData != "" || foundData != []) {
                const [rows] = await db.query(
                    `SELECT context FROM ${foundData[0]?.message}s WHERE keybot like "%${selectedOption}%" limit 10000`
                );

                let datas = rows.length > 0 ? rows[0].context : null;
                await bot.sendMessage(chatId, `Berikut penjelasan terkait '${selectedOption}' : `);
                // Bagi pesan panjang menjadi potongan-potongan
                const messageChunks = splitMessage(datas);
                // Kirim potongan pesan satu per satu

                messageChunks.forEach((chunk) => {
                    bot.sendMessage(chatId, chunk);
                });
                setTimeout(async () => {
                    await buttonFunc(callbackQuery.message, "Ada lagi yang dapat Chocky bantu : ", menuData)
                  }, 2000);

            } else {
                buttonFunc(callbackQuery.message, "Maaf, silhakan pilih opsi berikut : ", menuData)
            }
        }
    }
});

// Fungsi untuk memotong pesan panjang menjadi bagian-bagian kecil
function splitMessage(message, maxLength = 4096) {
    const chunks = [];
    while (message.length > maxLength) {
        let chunk = message.slice(0, maxLength);
        const lastSpace = chunk.lastIndexOf(' '); // Memotong di spasi terakhir agar kata tidak terpotong
        if (lastSpace > 0) {
            chunk = chunk.slice(0, lastSpace);
        }
        chunks.push(chunk);
        message = message.slice(chunk.length).trim();
    }
    if (message.length > 0) {
        chunks.push(message);
    }
    return chunks;
}

async function getResponseFromDatabase(userMessage, reqData, msg) {
    const chatId = msg.chat.id;
    const [datas] = await db.query(
        `SELECT keybot FROM ${reqData}s`
    );

    const dataArr = datas.map(obj => obj.keybot);
    const bestMatchKey = fuzz.extract(userMessage, dataArr);
    var datasFil = [];
    var datasFil100 = [];

    for (let index = 0; index < bestMatchKey.length; index++) {
        if (bestMatchKey[index][1] > 50) {
            if (bestMatchKey[index][1] == 100) {
                let dt100 = [
                    {
                        text: bestMatchKey[index][0],
                        callback_data: bestMatchKey[index][0],
                    }
                ];
                datasFil100.push(dt100)
            } else {
                let dt = [
                    {
                        text: bestMatchKey[index][0],
                        callback_data: bestMatchKey[index][0],
                    }
                ];
                datasFil.push(dt)
            }
        }
    }

    if (datasFil100.length != 0) {
        try {
            const [rows] = await db.query(
                `SELECT context FROM ${reqData}s WHERE keybot like "%${bestMatchKey[0][0]}%" limit 10000`
            );

            let datas = rows.length > 0 ? rows[0].context : null;
            await bot.sendMessage(chatId, `Berikut penjelasan terkait '${bestMatchKey[0][0]}' : `);
            // Bagi pesan panjang menjadi potongan-potongan
            const messageChunks = splitMessage(datas);
            // Kirim potongan pesan satu per satu

            messageChunks.forEach((chunk) => {
                bot.sendMessage(chatId, chunk);
            });
            // await bot.sendMessage(chatId, datas);
        } catch (error) {
            await bot.sendMessage(chatId, "Maaf, saya tidak menemukan informasi yang anda cari.😔");
        }
    } else {
        if (datasFil.length == 1) {
            try {
                const [rows] = await db.query(
                    `SELECT context FROM ${reqData}s WHERE keybot like "%${bestMatchKey[0][0]}%" limit 10000`
                );

                let datas = rows.length > 0 ? rows[0].context : null;
                await bot.sendMessage(chatId, `Berikut penjelasan terkait '${bestMatchKey[0][0]}' : `);
                // Bagi pesan panjang menjadi potongan-potongan
                const messageChunks = splitMessage(datas);
                // Kirim potongan pesan satu per satu

                messageChunks.forEach((chunk) => {
                    bot.sendMessage(chatId, chunk);
                });
                // await bot.sendMessage(chatId, datas);
            } catch (error) {
                await bot.sendMessage(chatId, "Maaf, saya tidak menemukan informasi yang anda cari.😔");
            }
        } else if (datasFil.length > 1) {
            await buttonFunc(msg, "Apakah ini yang anda maksud : ", datasFil)
        } else {
            await bot.sendMessage(chatId, "Maaf, saya tidak menemukan informasi yang anda cari.😔");
        }
    }

    setTimeout(async () => {
        await buttonFunc(msg, "Ada lagi yang dapat Chocky bantu : ", menuData)
      }, 2000);
}

// Event ketika bot menerima pesan
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text.toLowerCase();
    if (userMessage == "/start" || userMessage == "start" || userMessage == "mulai") {
        buttonFunc(msg, "Hallo teman seperjuangan, Saya Chocky asisten pribadi anda. Silahkan pilih opsi yang anda inginkan :", startData)
    } else if (userMessage == "/end" || userMessage == "end") {
        bot.sendMessage(chatId, "Senang bisa membantu anda🙏😁")
    } else {
        let foundData = "";
        function filterByID(item) {
            if (item.chatId == chatId) {
                return true;
            }
            return false;
        }

        foundData = jsonDataBefore.filter(filterByID)
        if (foundData.length == 0) {
        } else {
            if (foundData != "" || foundData != []) {
                await getResponseFromDatabase(userMessage, foundData[0]?.message, msg);
            } else {
                buttonFunc(msg, "Maaf, silhakan pilih opsi berikut : ", menuData)
            }
        }
    }
});

console.log("ChatBot sedang berjalan...");
