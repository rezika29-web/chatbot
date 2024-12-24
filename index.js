const TelegramBot = require('node-telegram-bot-api');
const stringSimilarity = require('string-similarity');
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
            text: 'PKL',
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
        (Contoh: Latar Belakang ${responseText})`);
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
                    `SELECT context FROM ${foundData[0]?.message}s WHERE title like "%${selectedOption}%"`

                );
                let resData = rows.length > 0 ? rows[0].context : null;
                await bot.sendMessage(chatId, resData)
                await buttonFunc(msg, "Ada lagi yang dapat Chocky bantu : ", menuData)

            } else {
                buttonFunc(msg, "Maaf, silhakan pilih opsi berikut : ", menuData)
            }
        }
    }
});

async function getResponseFromDatabase(userMessage, reqData, msg) {
    const chatId = msg.chat.id;

    const [datas] = await db.query(
        `SELECT title  FROM ${reqData}s`
    );
    const dataArr = datas.map(obj => obj.title);
    const bestMatchKey = stringSimilarity.findBestMatch(userMessage, dataArr);
    if (bestMatchKey.bestMatch.rating > 0.49) {
        try {
            const [rows] = await db.query(
                `SELECT context FROM ${reqData}s WHERE title like "%${bestMatchKey.bestMatch.target}%"`

            );
            let datas = rows.length > 0 ? rows[0].context : null;
            await bot.sendMessage(chatId, `Berikut penjelasan terkait '${bestMatchKey.bestMatch.target}' : `);
            await bot.sendMessage(chatId, datas);
        } catch (error) {
            await bot.sendMessage(chatId, "Maaf, saya tidak menemukan informasi yang anda cari.😔");
        }
    } else {
        let data = bestMatchKey.ratings;
        let filData = data.filter((item) => item.rating > 0)
        if (filData.length == 0) {
            await bot.sendMessage(chatId, "Maaf, saya tidak menemukan informasi yang anda cari.😔");
        } else {
            var datasFil = [];

            filData.forEach((val) => {
                if (val.rating > 0.2) {
                    let dt = [
                        {
                            text: val.target,
                            callback_data: val.target,
                        }
                    ];
                    datasFil.push(dt)
                }
            })
            buttonFunc(msg, "Apakah ini yang anda maksud : ", datasFil)
        }
    }
    await buttonFunc(msg, "Ada lagi yang dapat Chocky bantu : ", menuData)

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
        if (foundData != "" || foundData != []) {
            await getResponseFromDatabase(userMessage, foundData[0]?.message, msg);
        } else {
            buttonFunc(msg, "Maaf, silhakan pilih opsi berikut : ", menuData)
        }
    }
});

console.log("ChatBot sedang berjalan...");
